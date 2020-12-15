// Version 1
const _ = require('lodash');
const fs = require('fs-extra');
const path = require('path');
const spawnSync = require('child_process').spawnSync;
const rimraf = require('rimraf');
const jsonata = require('jsonata');

const LAMBDA_NAME = 'lambda';
const LAMBDA_FILE = `${LAMBDA_NAME}.js`;
const LAMBDA_HANDLER = 'handler';
const DEPLOY_FLOW_NAME = '__flow.json';

class KumologicaPlugin {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;
    this.originalServicePath = this.serverless.config.servicePath;
    this.fnName = this.pluckFnName(0); // get the first function that we found - 
    //TODO: Support for multi function needs to be added.
    this.fnNames = Object.keys(this.functions);
    
    this.inferIamPolicies = _.get(
      this.serverless, 
      'variables.service.custom.kumologica.inferIamPolicies', 
      true);
    
    this.excludeTest = _.get(
      this.serverless, 
      'variables.service.custom.kumologica.excludeTest', 
      false);

    this.env = this.serverless.service.getFunction(this.fnName).environment;

    this.hooks = {
      'before:package:createDeploymentArtifacts': () => {
        this.createArtefacts();
     },
      'before:package:compileFunctions': () => {
        this.attachHandlerToFunction(this.fnName);
      },
      'after:package:createDeploymentArtifacts': () => {
        this.cleanup();
      },
      'before:package:finalize': ()  => { 
        this.addFlowPolicies();
      }
    };
  }

  runCommand(command, args) {
    const result = spawnSync(command, args);
    const stdout = result.stdout;
    const sterr = result.stderr;
    
    if (stdout) {
      this.serverless.cli.log(stdout.toString());
    }
    
    if (sterr) {
      this.serverless.cli.log(sterr.toString());
    }
  }

  createArtefacts() {
    this.parseFlow();
    this.addLambdaFile();
    this.runNpm();
    this.packageLambda();
  }

  runNpm() {
    this.serverless.cli.log(`Running npm build ...`);
    this.runCommand('npm', ['install', '--production']);

    // Remove aws-sdk library as it is provided by aws nodejs runtime. 
    // Reducing the resulting lambda zip file by more than 70%
    rimraf.sync(path.join('.', 'node_modules', 'aws-sdk'));
  }

  attachHandlerToFunction(functionName) {
    this.serverless.cli.log(
      `Attaching handler to function: ${functionName} ...`
    );
    let fnObject = this.serverless.service.getFunction(functionName);
    fnObject.handler = `${LAMBDA_NAME}.${LAMBDA_HANDLER}`;
  }

  parseFlow() {
    this.flow = this.readFlow(this.fnName);

    if (this.excludeTest) {
      this.flow = this.flow.filter(f => f.z != "test.flow");
    } else {
      this.serverless.cli.log(`Skipping flow test exclusion, excludeTest not set or false`);
    }
    fs.writeFileSync(DEPLOY_FLOW_NAME, JSON.stringify(this.flow));
  }

  addLambdaFile() {
    this.serverless.cli.log(`Generating Lambda file: ${LAMBDA_FILE} ...`);
    let lambdaContent = this.generateLambdaContent();
    fs.writeFileSync(LAMBDA_FILE, lambdaContent);
  }

  validNodeType(node) {
    return node 
      && node.type 
      && ['Rekognition', 'S3', 'SQS', 'Cloudwatch', 'Dynamo DB', 'SNS', 'SES', 'SSM'].includes(node.type);
  }

  //
  // If inferIamPolicies is set to true or not provided then all relevant aws 
  // permissions are added to the iam role policies.
  // Each aws outbound note is inspected and correct actions and resources added to
  // thsle policies belonging to generated role.
  // The above only applies if aws resources are explicitly specifed as string values
  // in node properties or as references to lambda environment variables. In second case
  // the environment variables must be present in serverless.yml
  // 
  addFlowPolicies() {
    if (!this.inferIamPolicies) {
      this.serverless.cli.log(`Skipping flow policies, inferIamPolicies set to false`);
      return;
    }

    this.serverless.cli.log(`Adding flow policies to iam role of function: ${this.fnName} ...`);

    let nodes = this.flow.filter(node => this.validNodeType(node));
    if (!nodes || !nodes.length) {
      return;
    }

    let resources = {};

    for (var i=0; i<nodes.length; i++) {

      switch(nodes[i].type) {
        
        case 'Dynamo DB': 
          let tableArn = this.mapValue(nodes[i].tableArn);
          this.addResourceAction(resources, `dynamodb:${nodes[i].operation}`, tableArn);
          break;
        
        case 'SQS':
          let queueArn = this.mapQueueUrlToArn(this.mapValue(nodes[i].QueueUrl));
          this.addResourceAction(resources, `sqs:${nodes[i].operation}`, queueArn);
          break;

        case 'SNS':
          const topic = this.mapValue(nodes[i].publishTopic);
          this.addResourceAction(resources, `sns:${nodes[i].operation}`, topic);
          break;

        case 'SES':
          this.addResourceAction(resources, `ses:${nodes[i].operation}`, '*');
          break;
        
        case 'SSM':
          const key = this.mapValue(nodes[i].Key);
          const ssmArn = '!Sub arn:aws:ssm:${AWS::Region}:${AWS::AccountId}:parameter/' +key;
          this.addResourceAction(resources, `ssm:${nodes[i].operation}`, ssmArn);
          break;
      
        case 'S3':
          const bucketName = this.mapValue(nodes[i].Bucket);
          const bucketArn = `arn:aws:s3:::${bucketName}/*`;
          this.addResourceAction(resources, `s3:${nodes[i].operation}`, bucketArn);
          break;
      
        case 'Cloudwatch':
          let source = this.mapValue(nodes[i].Source);
          this.addResourceAction(resources, `event:${nodes[i].operation}`, source);
          break;
        
        case 'Rekognition':
          const resource = this.rekognition.mapResource(nodes[i].operation, region, '*', nodes[i]);
          this.addResourceAction(resources, `rekognition:${nodes[i].operation}`, resource);

          if (['DetectModerationLabels', 
              'DetectText', 
              'DetectLabels', 
              'DetectFaces', 
              'IndexFaces', 
              'RecognizeCelebrities', 
              'SearchFacesByImage', 
              'StartStreamProcessor',
              'StopStreamProcessor'].includes(nodes[i].operation)) {

            const bucketName = this.mapValue(nodes[i].Image);
            const bucketArn = `arn:aws:s3:::${bucketName}/*`;
            this.addResourceAction(resources, `s3:Get*`, bucketArn);
            this.addResourceAction(resources, `s3:List*`, bucketArn);
          }
        break;

        default:
          throw new Error(`Unsupported node type: ${node[i].type}, unable to generate IAM Policy.`); 
      }
    }
    
    this.serverless
          .service
          .provider
          .compiledCloudFormationTemplate
          .Resources
          .IamRoleLambdaExecution
          .Properties
          .Policies.push(this.createPolicy(resources));
  }

  mapQueueUrlToArn(queueUrl) {
    // https://sqs.region.amazonaws.com/account/queuename
    let urlparts = queueUrl.split('/');
    if (urlparts.length != 5) {
      throw new Error(`Unable to handle queue url: ${queueUrl} expected format https://sqs.region.amazonaws.com/account/queuename`);
    }

    let region = urlparts[2].split('.')[1];
    return `arn:aws:sqs:${region}:${urlparts[3]}:${urlparts[4]}`;   
  }

  /**
   * Creates Kumologica policy based on passed resources array.
   * Policy contains statements to allows specified actions 
   * for each resource in array.
   * 
   * @param {array} resources 
   */
  createPolicy(resources) {
    
    let policy = {
      PolicyName: "KumologicaPolicy",
      PolicyDocument: {
        Version: "2012-10-17",
        Statement: []
      }
    };

    policy.PolicyDocument.Statement = 
      Object.entries(resources)
            .map(([resource, actions]) => (
              {
                Effect: "Allow", 
                Resource: [JSON.parse(resource)], 
                Action: actions
              }
            ));    

    return policy;
  }

  readFlow(flowName) {
    const nodes = JSON.parse(fs.readFileSync(`${flowName}.json`));
    
    if (!nodes || !Array.isArray(nodes) || nodes.length == 0) {
      throw new Error('Unable to read and parse flow file, flow file appears corrupted.');
    }

    return nodes;
  }

/**
 * This is dynamic expression evaluation function that uses jsonata. 
 * It is simplified version of evaluateDynamicField function from runtime util.js. 
 * The version below only supports environment variables in expressions. 
 * 
 * If any error occurs during evaluation or evaluation returns no value 
 * the original value (key) is returned
 * 
 * @param {String} value - either literal string or jsonata expression with env reference
 */
mapValue(value) {

  if (!value) {
    return value; // nothing to evaluate
  }

  // data contains all objects for sourcing data for expression:
  // in plugin case only env are supported
  var data = {};
  data.env = this.env;

  let response;
  try {
    let expression = jsonata(value);
    response = expression.evaluate(data);

    if (!response) {
      response = value;
    }
  } catch (Error) {
    response = value;
  }

  return response;
}

  /**
   * Function adds new action for specified resource or 
   * instantiates new resource with action if not yet provided
   * 
   * @param {array} resources the buffer of resource actions (array)
   * @param {String} action Specific action (f.e. s3:GetObject)
   * @param {Object} resource Resource arn or formula (Sub, Ref ...) 
   */
  addResourceAction(resources, action, resource) {
    const resourceString = JSON.stringify(resource);
    const actions = resources[resourceString];
    if (!actions) {
      resources[resourceString] = [action];
    } else {
      if (!actions.includes(action)) {
        actions.push(action);
      }  
    }
  }

  generateLambdaContent() {
    return `
      'use strict';
      const { LambdaFlowBuilder } = require('@kumologica/runtime');
      const lambdaFlow = new LambdaFlowBuilder('${DEPLOY_FLOW_NAME}');
      exports.${LAMBDA_HANDLER} = lambdaFlow.handler;
      `;
  }

  pluckFnName(index) {
    if (!this.functions) {
      throw new Error('Functions cannot be empty');
    }
    let fnNames = Object.keys(this.functions);
    return fnNames[index];
  }

  get functions() {
    const { options } = this;
    const { service } = this.serverless;

    if (options.function) {
      return {
        [options.function]: service.functions[this.options.function]
      };
    }

    return service.functions;
  }

  packageLambda() {
    this.serverless.cli.log(`Including ${LAMBDA_FILE} and ${DEPLOY_FLOW_NAME} into package...`);

    if (!_.get(this.serverless.service, 'package.include')) {
      _.set(this.serverless.service, 'package.include', []);
    }

    this.serverless.service.package.include.push(DEPLOY_FLOW_NAME);
    this.serverless.service.package.include.push(LAMBDA_FILE);
  }

  cleanup() {
    this.serverless.cli.log(`Cleaning up temporary files...`);
    if (fs.existsSync(LAMBDA_FILE)) {
      fs.removeSync(LAMBDA_FILE);
    }
    fs.removeSync(`${DEPLOY_FLOW_NAME}`);
  }
}

module.exports = KumologicaPlugin;
