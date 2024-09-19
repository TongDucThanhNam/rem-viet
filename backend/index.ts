import express from 'express';
import morgan from 'morgan';
import productRoutes from './Api/Routes/ProductRoutes';
const swaggerUi = require('swagger-ui-express');
import 'dotenv/config';

const swaggerFile = require('./swagger_output.json');

const PORT = process.env.PORT;
const app = express()

app.use(morgan("dev"));

if (express.json) {
    app.use(express.json());
} else {
    console.error("express.json() is not available");
}

//product
app.use("/api", productRoutes);

app.use("/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerFile)
);


app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
})