// Version 1
const _ = require('lodash');
const fs = require('fs-extra');

const LAMBDA_NAME = 'lambda';
const LAMBDA_FILE = `${LAMBDA_NAME}.js`;
const LAMBDA_HANDLER = 'handler';

class KumologicaPlugin {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;
    this.originalServicePath = this.serverless.config.servicePath;

    this.hooks = {
      'before:package:createDeploymentArtifacts': () => {
        this.addLambdaFile();
        this.packageLambda();
      },
      'before:package:compileFunctions': () => {
        this.attachHandlerToFunction();
      },
      'after:package:createDeploymentArtifacts': () => {
        this.cleanup();
      }
    };
  }

  attachHandlerToFunction() {
    this.serverless.cli.log(
      `Attaching handler to function: ${this.fnName} ...`
    );
    let fnObject = this.serverless.service.getFunction(this.fnName);
    fnObject.handler = `${LAMBDA_NAME}.${LAMBDA_HANDLER}`;
  }

  addLambdaFile() {
    this.serverless.cli.log(`Generating Lambda file: ${LAMBDA_FILE} ...`);
    this.fnName = this.pluckFnName(0); // get the first function that we found - TODO: Support for multi function needs to be added.
    let lambdaContent = this.generateLambdaContent(this.fnName);
    fs.writeFileSync(LAMBDA_FILE, lambdaContent);
  }

  generateLambdaContent(fnName) {
    let content = `
      'use strict';
      const { LambdaFlowBuilder } = require('@kumologica/runtime');
      const lambdaFlow = new LambdaFlowBuilder('${fnName}.json');
      exports.${LAMBDA_HANDLER} = lambdaFlow.handler;
      `;
    return content;
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
    this.serverless.cli.log(`Including ${LAMBDA_FILE} into package...`);

    if (!_.get(this.serverless.service, 'package.include')) {
      _.set(this.serverless.service, 'package.include', []);
    }

    this.serverless.service.package.include.push(LAMBDA_FILE);
  }

  cleanup() {
    this.serverless.cli.log(`Cleaning up temporary files...`);
    if (fs.existsSync(LAMBDA_FILE)) {
      // fs.unlinkSync(LAMBDA_FILE);
      fs.removeSync(LAMBDA_FILE);
    }
  }
}

module.exports = KumologicaPlugin;
