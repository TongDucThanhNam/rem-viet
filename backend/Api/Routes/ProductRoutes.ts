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

//create product route
router.post('/product', productController.createProduct);

//Update product route
router.put('/product/:productId', productController.updateProduct);

//Delete product route
router.delete('/product/:productId', productController.deleteProduct);

export default router;