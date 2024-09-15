// import express from 'express';
const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerFile = require('./swagger_output.json');
const cors = require('cors');
// const { saveLog } = require('./src/Api/Middlewares/saveLog');

const productRoutes = require('./Api/Routes/ProductRoutes');
const morgan = require('morgan');
require('dotenv').config();

const PORT = process.env.PORT;
const app = express();

app.use(morgan("dev"));
app.use(express.json());

app.use(cors({
    origin: 'http://localhost:3000'
}));

//product
app.use('/api', productRoutes);

app.use('/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerFile)
)

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
})