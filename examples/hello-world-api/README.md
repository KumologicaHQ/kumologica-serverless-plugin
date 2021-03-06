# Quickstart

There are a few prerequisites you need to install and configure:

- Install Node.js 6.x or later on your local machine
- Install the Serverless Framework open-source CLI version 1.47.0 or later

If you already have these prerequisites setup you can skip ahead to Create a new service from a Template.

<div class="alert alert-info"> 
This example shows default capabilities of the serverless plugin and templates that expose hello world api and this example does not provide any code, all artefacts will be created by template and plugin.
</div>

## Install Dependencies

**Install Node.js and NPM**

- Follow these [installation instructions](https://nodejs.org/en/download/)
- You should be able to run node -v from your command line and get a result like this...

```
$ node -v
vx.x.x
```

You should also be able to run npm -v from your command line and should see...

```
$ npm -v
x.x.x
```

**Install serverless framework**

Follow instructions from [Serverless getting-started](https://www.serverless.com/framework/docs/getting-started/)
to install serverless framework.

To verify successful installation, run following command:
```bash
$ sls --version
```

Output of the command should look similar to below:

```bash
$ sls --version
Framework Core: 1.67.3
Plugin: 3.6.6
SDK: 2.3.0
Components: 2.29.3
```

## Create new kumologica service from a Template

Use the Serverless Framework open-source CLI to create a new Service:

```
sls create \
  --template-url https://github.com/KumologicaHQ/serverless-templates/tree/master/helloworld-api \
  --path helloworld-api
```

<div class="alert alert-info"> 
Kumologica projects can be deployed on different serverless platforms. As a consequence, it is not required to provide a lambda file or specify the `handler` key within your `serverless.yml` file. The plugin `kumologica-serverless` will take care of those details for you.

After lambda file is created by plugin, the npm install is called and all node modules specified in package.json are installed. All modules are deleted at the end of deploy process.

If you are interested, you can always unzip the artefact file within the `.serverless` directory to see the effect of the plugin or see the final version of cloud formation scripts generated.

</div>

**Install kumologica-serverless plugin**

Run the following command in your terminal to install dependant node modules. This command needs to be run only once.
 
```
serverless plugin install --name kumologica-serverless-plugin
```

## Edit your Flow

Install [Kumologica Designer](https://kumologica.com/download.html) to open and modify your flow.
The default flow handles api call GET /dev/hello and returns hello world. Kumologica designer allows
implementation of any integration flow providing rich set of outbound nodes and additional repository of 
contribution flows.

Kumologica Designer is available for free on Windows or Mac.

## Deploy your flow

Use these commands to deploy your service for the first time and after you make changes to your kumologica flow, Events or Environment variables in serverless.yml.

To use default profile and region:

```
sls deploy -v
```

To use specific profile and region:
```
sls deploy -v --profile {YOUR PROFILE NAME} --region {YOUR REGION NAME}
```
The output should be similar to:

```bash
Serverless: Stack update finished...
Service Information
service: helloworld-api
stage: dev
region: ap-southeast-2
stack: helloworld-api-dev
resources: 11
api keys:
  None
endpoints:
  GET - https://xxxxxxxxxx.execute-api.ap-southeast-2.amazonaws.com/dev/hello
functions:
  helloworld-flow: helloworld-api-dev-helloworld-flow
layers:
  None
```

Make a note of endpoint displayed, this url can be used to test deployment.

## Test your service

Default kumologica flow deployed to AWS exposes GET /dev/hello api. Serverless creates "dev" stage by default.
Replace the URL in the following curl command with your returned endpoint URL, which you can find in the sls deploy output, to hit your URL endpoint.

```
$ curl -X GET https://{api-gw-id}.execute-api.{your_region}.amazonaws.com/dev/hello
```

the output of above command should look like:

```bash
{"hello": "world"}
```

## Remove your Service

If at any point you no longer need your Service, you can run the following command to remove the function, event and resources that were created.

```
sls remove
```

# About Kumologica

Kumologica is a low code platform to rapidly and safely author lambda functions.

Kumologica is made of two main components:

- **Kumologica Designer**: Flow based tool to create API and integration flows visually. You can download it for free on: [Download](https://kumologica.com/download.html)

- **Kumologica Runtime**: Node library that run your flows in various serverless compute platforms (AWS, Azure, ...)
