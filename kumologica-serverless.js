// Version 1
const _ = require('lodash');
const fs = require('fs-extra');
const path = require('path');
const jp = require('jsonpath');
const spawnSync = require('child_process').spawnSync;
const rimraf = require('rimraf');

const LAMBDA_NAME = 'lambda';
const LAMBDA_FILE = `${LAMBDA_NAME}.js`;
const LAMBDA_HANDLER = 'handler';
const DEPLOY_FLOW_NAME = '__flow.json';

class KumologicaPlugin {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;
    this.originalServicePath = this.serverless.config.servicePath;
    this.fnName = this.pluckFnName(0); 
    // get the first function that we found - TODO: Support for multi function needs to be added.
    
    this.inferIamPolicies = _.get(
      this.serverless, 
      'variables.service.custom.kumologica.inferIamPolicies', 
      false);
    
    this.excludeTest = _.get(
      this.serverless, 
      'variables.service.custom.kumologica.excludeTest', 
      false);

    this.env = this.serverless.service.getFunction(this.fnName).environment;
  
    this.hooks = {
      'before:package:createDeploymentArtifacts': () => {
        this.parseFlow();
        this.addLambdaFile();
        this.runNpm();
        this.packageLambda();
      },
      'before:package:compileFunctions': () => {
        this.attachHandlerToFunction();
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

  runNpm() {
    this.serverless.cli.log(`Running npm build ...`);
    this.runCommand('npm', ['install', '--production']);

    // Remove aws-sdk library as it is provided by aws nodejs runtime. 
    // Reducing the resulting lambda zip file by more than 70%
    rimraf.sync(path.join('.', 'node_modules', 'aws-sdk'));
  }

  attachHandlerToFunction() {
    this.serverless.cli.log(
      `Attaching handler to function: ${this.fnName} ...`
    );
    let fnObject = this.serverless.service.getFunction(this.fnName);
    fnObject.handler = `${LAMBDA_NAME}.${LAMBDA_HANDLER}`;
  }

  parseFlow() {
    this.flow = this.readFlow();

    if (this.excludeTest) {
      this.flow = this.flow.filter(f => f.z != "test.flow");
    } else {
      this.serverless.cli.log(`Skipping flow test exclusion, excludeTest not set or false`);
    }
    this.writeFlow();
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

  addFlowPolicies() {
    this.serverless.cli.log(`Adding flow policies to iam role of function: ${this.fnName} ...`);

    this.findLambdaRole(); 
    
    let nodes = this.flow.filter(node => this.validNodeType(node));

    if (!this.inferIamPolicies) {
      this.serverless.cli.log(`Skipping flow policies, inferIamPolicies not set or false`);
      return;
    }

    for (var i=0; i<nodes.length; i++) {

      switch(nodes[i].type) {
        
        case 'Dynamo DB': 
          let tableArn = this.mapValue(nodes[i].tableArnType, nodes[i].tableArn);
          let tableParts = tableArn.split(":");
          
          if (!tableParts || tableParts.length != 6) {
            throw new Error(`Invalid value of dynamo db table arn: ${tableArn}, looks like arn provided is not in valid arn format.`);
          }

          let tableName = tableParts[5].replace('table/', '');
          this.updatePolicy(`KumologicaDynamoDbPolicy${tableName}`, `dynamodb:${nodes[i].operation}`, tableArn);
          break;
        
        case 'SQS':
          let queueArn = this.mapValue(nodes[i].QueueUrlType, nodes[i].QueueArn);
          let queueName = queueArn.split(":")[5];
          this.updatePolicy(`KumologicaSQSPolicy${queueName}`, `sqs:${nodes[i].operation}`, queueArn);
          break;

        case 'SNS':
          const topic = this.mapValue(nodes[i].publishTopicType, nodes[i].publishTopic);
          this.updatePolicy(`KumologicaSNSPolicy${topic}`, `sns:${nodes[i].operation}`, topic);
          break;

        case 'SES':
          this.updatePolicy(`KumologicaSESPolicy`, `ses:${nodes[i].operation}`, '*');
          break;
        
        case 'SSM':
          const key = this.mapValue(nodes[i].KeyType, nodes[i].Key);
          const ssmArn = `arn:aws:ssm:${AWS.config.region}:${AWS.config.accountId}:parameter/${key}`;
          this.updatePolicy(`KumologicaSSMPolicy${key}`, `ssm:${nodes[i].operation}`, ssmArn);
          break;
      
        case 'S3':
          let bucketName = this.mapValue(nodes[i].BucketType, nodes[i].Bucket);
          const bucketArn = `arn:aws:s3:::${bucketName}/*`;
          this.updatePolicy(`KumologicaS3Policy${bucketName}`, `s3:${nodes[i].operation}`, bucketArn);
          break;
      
        case 'Cloudwatch':
          let source = this.mapValue(nodes[i].SourceType, nodes[i].Source);
          this.updatePolicy(`KumologicaCloudwatchEventPolicy${source}`, `event:${nodes[i].operation}`, source);
          break;
        
        case 'Rekognition':
          this.updatePolicy(`KumologicaRekognitionPolicy${nodes[i].CollectionId}`, `rekognition:${nodes[i].operation}`, nodes[i].CollectionId);
          break;

        default:
          throw new Error(`Unsupported node type: ${node[i].type}, unable to generate IAM Policy.`); 
      }
    }
  }

  findLambdaRole() {
    this.lambdaRole = 
      this.serverless
          .service
          .provider
          .compiledCloudFormationTemplate
          .Resources
          .IamRoleLambdaExecution;
        
    if (!this.lambdaRole) {
      throw new Error('Unable to find Lambda Role in compiled cloud formation template.');
    }
  }

  readFlow() {
    const nodes = JSON.parse(fs.readFileSync(`${this.fnName}.json`));
    
    if (!nodes || !Array.isArray(nodes) || nodes.length == 0) {
      throw new Error('Unable to read and parse flow file, flow file appears corrupted.');
    }

    return nodes;
  }

  writeFlow() {
    fs.writeFileSync(`${DEPLOY_FLOW_NAME}`, JSON.stringify(this.flow));
    // let exception flow
  }

  // 
  // Function allows the storage of aws resource identifier (arn or other)
  // in either:
  // - string property - value returned as is (key input)
  // - env property    - key input is a key to reference environment variable.
  //                     if env variables got key missing then error is returned
  // if var or msg properties are used then error is returned, 
  // in these cases its impossible to determine the value 
  // and role must be explicitly defined in serverless.yml
  //
  mapValue(type, key) {
    let value;
    
    if (type && type == 'caenv') {
      value = this.env[key];
      if (!value) {
        throw new Error(`Missing Environment variable: ${key}`);
      }
    
    } else if (!type || type == 'str') {
      value = key;
    
    } else {
      throw new Error('Only String and Environment variables are supported sources of values. To use other types you must specify explicit role arn in function properties and set inferIamRoles=false.');
    }
    
    return value;
  }

  // 
  // Function handles policy changes for specific resource:
  // - creates new policy for resource if not found
  // - updates existing resource policy (if found) with new permissions 
  //
  updatePolicy(policyName, action, resource) {
    policyName = policyName.replace('/', '-');
    let policy = jp.query(this.lambdaRole.Properties, `Policies[?(@.PolicyName=='${policyName}')]`);    
    
    if (policy.length == 1) {
      policy[0].PolicyDocument.Statement[0].Action.push(action);
    
    } else {
      this.lambdaRole.Properties.Policies.push(
        this.outputPolicy(policyName, action, resource));
    }
  }

  outputPolicy(policyName, action, resource) {
    return {
      PolicyName: policyName,
      PolicyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Action: [action],
            Resource: resource,
            Effect: 'Allow'
          }
        ]
      }
    };
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
    rimraf.sync(path.join('.', 'node_modules'));
    fs.removeSync(`${DEPLOY_FLOW_NAME}`);
  }
}

module.exports = KumologicaPlugin;
