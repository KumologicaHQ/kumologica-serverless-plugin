# Kumologica Serverless Examples

Set of examples of kumologica flows managed by kumologica serverless plugin. Each example contains own specific description.

| Example | 
|:--------------------------|
| [Hello World - API](https://github.com/KumologicaHQ/kumologica-serverless-plugin/tree/master/examples/hello-world-api) <br /> The hello world example exposing kumologica flow as api endpoint |
| [Dynamo DB - API](https://github.com/KumologicaHQ/kumologica-serverless-plugin/tree/master/examples/hello-world-api) <br /> Dynamo DB CRUD operations of kumologica flow exposed as API. The DynamoDB table is created inside serverless.yml file and arn attribute reference is passed to flow's environment variable. This demo uses default kumologica plugin behaviour: automatically creates iam policy and attaches it to the role created by serverless. |

# About Kumologica

Kumologica is a low code platform to rapidly and safely author lambda functions.

Kumologica is made of two main components:

- **Kumologica Designer**: Flow based tool to create API and integration flows visually. You can download it for free on: [Download](https://kumologica.com/download.html)

- **Kumologica Runtime**: Node library that run your flows in various serverless compute platforms (AWS, Azure, ...)