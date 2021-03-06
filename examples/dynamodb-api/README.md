Demo presenting kumologica flow exposing CRUD operations on dynamo db using api.

- [Dependencies](#dependencies)
- [Installation](#installation)
- [Edit your flow](#edit-your-flow)
- [Deploy your flow](#deploy-your-flow)
- [Test your flow](#test-your-flow)
  * [Create item](#create-item)
  * [Get single item](#get-single-item)
  * [Get all items](#get-all-items)
  * [Delete item](#delete-item)
- [Remove your flow](#remove-your-flow)
- [About Kumologica](#about-kumologica)

# Dependencies

There are a few prerequisites you need to install and configure:

- [NPM](https://www.npmjs.com/get-npm)
- [Serverless](https://serverless.com/framework/docs/getting-started/)
- [Kumologica Designer](https://kumologica.com/download.html)
- [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-install.html)
- [AWS Profile](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html)

If you already have these prerequisites setup you can skip ahead to run example.

# Installation 

Checkout source code of this example into your local directory:

```bash
git clone https://github.com/KumologicaHQ/kumologica-serverless-plugin.git
cd kumologica-serverless-plugin/examples/dynamodb-api/

```

Run the following command in your terminal to install kumologica-serverless-plugin

```bash
serverless plugin install --name kumologica-serverless-plugin
```

Kumologica projects can be deployed on different serverless platforms. As a consequence, it is not required to provide a lambda file or specify the `handler` key within your `serverless.yml` file. The `kumologica-serverless-plugin` will take care of those details for you.

After lambda file is created by plugin, the npm install is called and all node modules specified in package.json are installed. All modules are deleted at the end of deploy process.

If you are interested, you can always check the `.serverless` directory to see the effect of the plugin or see the final version of cloud formation scripts generated.

# Edit your flow

Install [Kumologica Designer](https://kumologica.com/download.html) to open and modify your flow.
Kumologica designer allows implementation of any integration flow providing rich set of outbound nodes and additional repository of contribution flows. Kumologica Designer is available for free on Windows or Mac.

# Deploy your flow

Provided serverless.yml file defines all required resources: flow definition and dynamo db table that flow depends on.

To use default profile and region for deployment:

```
sls deploy -v
```

To use specific profile and region (Note that `--aws-region` parameter only works if AWS_PROFILE is not set.)

``` bash
export AWS_PROFILE={your profile}
sls deploy -v --region {YOUR REGION NAME}
```
or

```bash
unset AWS_PROFILE
sls deploy -v --aws-profile {YOUR PROFILE NAME} --region {YOUR REGION NAME}
```

Note all reported api endpoints:

```bash
Serverless: Stack update finished...
Service Information
...
endpoints:
  GET - https://{apigw-id}.execute-api.{region}.amazonaws.com/dev/user/{userId}
  DELETE - https://{apigw-id}.execute-api.{region}.amazonaws.com/dev/user/{userId}
  GET - https://{apigw-id}.execute-api.{region}.amazonaws.com/dev/user
  PUT - https://{apigw-id}.execute-api.{region}.amazonaws.com/dev/user
```

# Test your flow

DynamoDB example exposes 4 endpoints to demonstrate CRUD operations exposed as api.
Run commands provided below to test each api.

## Create item

```bash
curl -X PUT 'https://{apigw-id}.execute-api.{region}.amazonaws.com/dev/user' \
-H 'Content-Type: application/json' \
-d '{"userId": "user7","name": "Alice Smith"}'
```

## Get single item
```bash
curl -X GET 'https://{apigw-id}.execute-api.{region}.amazonaws.com/dev/user/user7' 
```

## Get all items
```bash
curl -X GET 'https://{apigw-id}.execute-api.{region}.amazonaws.com/dev/user' 
```
## Delete item

```bash
curl -X DELETE 'https://{apigw-id}.execute-api.{region}.amazonaws.com/dev/user/user7' 
```

# Remove your flow

To remove flow and its corresponding resources from aws account:

```
sls remove
```

# About Kumologica

Kumologica is a low code platform to rapidly and safely author lambda functions.

Kumologica is made of two main components:

- **Kumologica Designer**: Flow based tool to create API and integration flows visually. You can download it for free on: [Download](https://kumologica.com/download.html)

- **Kumologica Runtime**: Node library that run your flows in various serverless compute platforms (AWS, Azure, ...)
