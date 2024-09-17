import ProductController from "../Controllers/ProductController";
import express from "express";

const router = express.Router();

const productController = new ProductController();

//getAll products route
router.get('/products', productController.getAllProducts);

//get product by id route
router.get('/product/:productId', productController.getProductById);

//get product and variant by id route
router.get('/product/:productId/variant', productController.getProductAndVariantById);

router.post('/product', productController.createProduct);

module.exports = router;