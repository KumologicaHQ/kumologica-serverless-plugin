# Serverless plugin for Kumologica

[![serverless](http://public.serverless.com/badges/v3.svg)](http://www.serverless.com)
[![npm](https://img.shields.io/npm/dm/kumologica-serverless-plugin.svg)](https://github.com/KumologicaHQ/kumologica-serverless-plugin)
[![npm](https://img.shields.io/npm/v/kumologica-serverless-plugin.svg)](https://github.com/KumologicaHQ/kumologica-serverless-plugin)
[![npm](https://img.shields.io/npm/l/kumologica-serverless-plugin)](https://github.com/KumologicaHQ/kumologica-serverless-plugin)

This is serverless plugin that allows deployment of kumologica flow into aws account.

## Installation

**Install latest Npm and NodeJs**

Follow instructions from [get-npm](https://www.npmjs.com/get-npm)

**Install the Serverless Framework**

Follow instructions from [Get started with Serverless Framework Open Source & AWS](https://serverless.com/framework/docs/getting-started/)
 
## Sample project

**Kumologica Serverless Template**

Create new kumologica project with hello world flow using serverless template:

``` bash
sls create --template-url https://github.com/KumologicaHQ/serverless-templates/tree/master/helloworld-api --path helloworld-api
```

The command above should produce output similar to:

``` bash
$ sls create --template-url https://github.com/KumologicaHQ/serverless-templates/tree/master/helloworld-api --path helloworld-test
Serverless: Generating boilerplate...
Serverless: Downloading and installing "helloworld-api"...
Serverless: Successfully installed "helloworld-api" 
```

This will create new directory: helloworld-api with following files:
- hello-world-flow.json
- package.json
- serverless.yml

**Install kumologica-serverless plugin**

Once sample kumologica project has been created, run the following command in your terminal to install kumologica-serverless-plugin:

``` bash
sls plugin install --name kumologica-serverless-plugin
```

Successful installation should produce output similar to below:

``` bash
$ serverless plugin install --name kumologica-serverless-plugin
Serverless: Plugin not found in serverless registry, continuing to install
Serverless: Installing plugin "kumologica-serverless-plugin@latest" (this might take a few seconds...)
Serverless: Successfully installed "kumologica-serverless-plugin@latest"
```
## Development

Download [Kumologica Designer](https://kumologica.com/download.html) to edit flow, implement business logic and unit tests. 

![Kumologica Designer Screenshot](https://kumologica.com/docs/assets/img/designer-explainer.png)

This is the only tool you will need to build serverless integrations to run on your cloud.
No credit cards. No trials. Free to download and use it.

## Deployment

**IAM Role Policies**

Before deployment to aws, add events into serverless.yml as you would do for aws lambda. Sample project
has api gateway /hello defined. If you edited flow and implemented your own logic, this event is most likely not needed and should be removed from serverless.yml file.

Kumologica flow may interact with several aws services. In such a case correct permissions must be added to policies that are assigned to lambda's role.
If flow has ARNs of all aws resources provided in nodes properties, or nodes properties are referencing those ARNs via lambda's environment properties then kumologica-serverless plugin will automatically update those policies during deployment. 

If flow has references to ARNs using variables or message then it is not possible to determine their values at deploy time. In those scenarios it is necessary to specify those resources and actions in serverless.yml file. In such a cases inferIamPolicies must be included in serverless.yml file and set to false, otherwise kumologica-serverless-plugin will throw error when processing deploy command.

To disable policies update, add custom property inferIamPolicies into serverless.yml file and set it to false:

``` yaml
custom:
  kumologica:
    inferIamPolicies: false # true by default
```

**Test cases**

Komologica flow is internally divided into two sections: main and test. The test section should contain test cases and are not needed for correctly running flow in aws account.
To remove test related nodes from flow during deployment use excludeTest custom property in serverless.yml and set it to true. The kumologica-serverless plugin will remove test nodes from flow during deployment:

``` yaml
custom:
  kumologica:
    excludeTest: true      # false by default
```

To deploy flow into aws account use serverless deploy command, for example:

``` bash
sls deploy --aws-profile {aws profile} --region {aws region}
```

kumologica-serverless plugin is generating lambda file and runs npm install command during deployment.

## Testing 

To run flow locally serverless invoke command, for example:

``` bash
sls invoke -f helloworld-flow
```

## Cleanup

To remove flow from aws account use serverless remove command:

``` bash
sls remove
```

## Other Useful Commands

To see cloudformation scripts generated by serverless and kumologica-serverless plugin run:

``` bash
sls package -v
```

## serverless.yml examples

**Most Basic example**

Below is a serverless.yml file that will automatically update Role's policies.
In this scenarios flow has ARNs entered as a string values in flow properties.

``` yaml
service: hello-world

provider:
  name: aws
  runtime: nodejs12.x

functions:
  demo-flow: # name of your flow file (without .json extension)
    events:
      - http:
          path: hello
          method: get

plugins:
  - kumologica-serverless-plugin
```

**Use of Lambda's Environment variables**

Below example shows flow that references ARNs via lambda's environment variables (the arn of dynamo db table that flow uses). This allows greater flexibility in allowing the same flow to be deployed into multiple accounts or configurations without need of flow change.
The kumologica-serverless-plugin will add specific actions from flows for resource arn:aws:dynamodb:ap-southeast-2:{account}:table/contacts to the lambda's role during deployment.

``` yaml
service: hello-world

provider:
  name: aws
  runtime: nodejs12.x

functions:
  demo-flow: # name of your flow file (without .json extension)
    environment:
      dynamodbArn: arn:aws:dynamodb:{self:provider.region}:{accountId}:table/contacts
    events:
      - http:
          path: hello
          method: get

plugins:
  - kumologica-serverless-plugin
```

**Explicit IAM Role statements**

Below example relates to flow that may user ARN of resource in input message or ARN is setup using scripting. In such a case the ARN is only known at runtime and is impossible to determine it during deployment. Such a scenario requires disabling inferIamPolicies.

Additionally example shows that all test cases that are added into test parts of flow will be removed.

``` yaml
service: hello-world

provider:
  name: aws
  runtime: nodejs12.x
  iamRoleStatements:
    - Effect: "Allow"
      Action:
      - dynamodb:Query
      - dynamodb:Scan
      Resource: "arn:aws:dynamodb:{self:provider.region}:{accountId}:table/contacts"

functions:
  demo-flow: # name of your flow file (without .json extension)
    events:
      - http:
          path: hello
          method: get

custom:
  kumologica:
    inferIamPolicies: false # true by default
    excludeTest: true       # false by default

plugins:
  - kumologica-serverless-plugin
```

## License
This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.
