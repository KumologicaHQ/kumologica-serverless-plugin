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
  demo-flow: // <-- name of your flow file (without .json extension)
    events:
      - http:
          path: hello
          method: get

custom:
   kumologica:
     inferIamRoles: true, // false by default
     excludeTest: true    // false by default

plugins:
  - kumologica-serverless

```

# Useful Commands

sls create --template-url https://github.com/KumologicaHQ/serverless-templates/tree/master/helloworld-api --path helloworld-api
sls deploy --aws-profile personal
sls invoke -f helloworld-flow
sls remove

# Nodes

Location of your plugin during development will be in `.serverless_plugin`. For production, we will publish the module, and the normal install will be suffice.
