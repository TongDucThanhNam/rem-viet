import ProductController from "../Controllers/ProductController";
import express from "express";

const router = express.Router();

const productController = new ProductController();

//getAll products route
router.get('/products', productController.getAllProducts);

//get san-pham by id route
router.get('/product/:productId', productController.getProductById);

//get san-pham and variant by id route
router.get('/product/:productId/variant', productController.getProductAndVariantById);

//create san-pham route
router.post('/product', productController.createProduct);

//Update san-pham route
router.put('/product/:productId', productController.updateProduct);

//Delete san-pham route
router.delete('/product/:productId', productController.deleteProduct);

export default router;