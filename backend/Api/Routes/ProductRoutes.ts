import ProductController from "../Controllers/ProductController";
import express from "express";

const router = express.Router();

const productController = new ProductController();

router.post('/product', productController.createProduct);

//getAll products route
router.get('/products', productController.getAllProducts);

//get product by id route
router.get('/product/:productId', productController.getProductById);

module.exports = router;