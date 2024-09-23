require("dotenv").config();

const options = {
    openapi: true,     // Enable/Disable OpenAPI.                        By default is null
    language: 'en-US',     // Change response language.                      By default is 'en-US'
    disableLogs: true,       // Enable/Disable logs.                           By default is false
    autoHeaders: true,        // Enable/Disable automatic headers recognition.  By default is true
    autoQuery: true,        // Enable/Disable automatic query recognition.    By default is true
    autoBody: true,        // Enable/Disable automatic body recognition.     By default is true
    writeOutputFile: true         // Enable/Disable writing the output file.        By default is true
};
import swaggerAutogen from 'swagger-autogen';
const outputFile = './swagger_output.json';
const endpointsFiles = ['./Api/Routes/*.ts'];
// const endpointsFiles = ['./index.ts'];

const doc = {
    info: {
        verson: "1.0.1",
        title: 'E-commerce API',
        description: 'API documentation for E-commerce',
    },
    host: `localhost:${process.env.PORT}/api`,
    basePath: '/',
    schemes: ['http'],
    consumes: ['application/json'],
    produces: ['application/json'],
    tags: [
        {
            "name": "Products",
            "description": "Endpoints related to products"
        },

    ],
    securityDefinitions: {
        apiKeyAuth: { // This name should match the key in your route comment
            type: 'apiKey',
            in: 'header', // The location of the API key (header is a common location)
            name: 'Authorization', // The name of the header to be used
            description: "Please enter JWT or API Key with Bearer into field"
        }
    },
    definitions: {}
};

swaggerAutogen(options)(outputFile, endpointsFiles, doc).then(() => {
    console.log('Swagger documentation generated successfully');
});
