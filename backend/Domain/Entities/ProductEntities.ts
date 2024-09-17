import mongoose from "mongoose";
import {BaseSchema} from "./BaseEntities";

export const ProductSchema = new mongoose.Schema({
    imageUrls: {type: Array},
    name: {type: String, required: true},
    description: {type: String},
    size: {type: Array},
    price: {type: String},
});

const ProductWithBaseSchema = new mongoose.Schema({
    ...ProductSchema.obj,
    ...BaseSchema.obj
})

export const ProductWithBase = mongoose.model('ProductWithBase', ProductWithBaseSchema, 'products');