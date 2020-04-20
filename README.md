# Project Structure

- hello-world-flow.json
- package.json
- serverless.yml

## Serverless.yml

```
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

custom:
   kumologica:
     inferIamPolicies: true # false by default
     excludeTest: true      # false by default

plugins:
  - kumologica-serverless

```

# Useful Commands

To create new kumologica project with hello world flow:
```
sls create --template-url https://github.com/KumologicaHQ/serverless-templates/tree/master/helloworld-api --path helloworld-api
```

To deploy flow into aws account:

```
sls deploy --aws-profile personal
```
To see cloudformation scripts:

```
sls package -v
```

To run flow locally:
```
sls invoke -f helloworld-flow
```

To remove flow from aws account:

```
sls remove
```

# Nodes

- For plugin development put absolute path to plugin sources in serverless.yml file

- Another alternative is to create `.serverless_plugins` subdirectory inside project. 

For production, we will publish the module, and the normal install will suffice.
