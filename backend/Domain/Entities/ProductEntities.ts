import mongoose from "mongoose";
import {BaseSchema} from "./BaseEntities";

export const ProductSchema = new mongoose.Schema({
    //Product Slugs
    slug: {type: String, required: true},
    //Product Images
    imageUrls: {type: Array},
    //Product Name
    name: {type: String, required: true},
    //Product Description
    description: {type: String},
    //Product Size
    size: {type: Array},
    //Product price
    price: {type: String},
    //soldQuantity
    soldQuantity: {type: Number, default: 0},
    //Product Quantity
    quantity: {type: Number, required: true},
    //Product Rating
    rating: {type: Number, default: 0},
    //Product Reviews count
    reviewsCount: {type: Number, default: 0},
    //----Foriegn Key---
    //Category
    categoryId: {type: mongoose.Schema.Types.ObjectId, ref: 'Category'},
});

const ProductWithBaseSchema = new mongoose.Schema({
    ...ProductSchema.obj,
    ...BaseSchema.obj
})

export const ProductWithBase = mongoose.model('ProductWithBase', ProductWithBaseSchema, 'products');