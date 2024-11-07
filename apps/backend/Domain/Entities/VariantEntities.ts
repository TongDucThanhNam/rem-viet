// variant.js
import {BaseSchema} from "./BaseEntities";

import mongoose from 'mongoose';

//    {"key":2,"values":{"Colors":"R","Sizes":"L"},"price":3},
const variantSchema = new mongoose.Schema({
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ProductWithBase',
        required: true
    },
    key: {type: Number, required: true}, // Key của variant
    variantPrice: {type: Number, required: true}, // Giá của variant
    values: {type: Object, required: true}, // Giá trị của variant
});

const VariantWithBaseSchema = new mongoose.Schema({
    ...variantSchema.obj,
    ...BaseSchema.obj
});

export const VariantWithBase = mongoose.model('VariantWithBase', VariantWithBaseSchema, 'variants');