import mongoose from "mongoose";
import {BaseSchema} from "./BaseEntities.ts";

export const PromotionSchema = new mongoose.Schema({
    discountType: {type: String, required: true},
    discountValue: {type: Number, required: true},
    startDate: {type: Date, required: true},
    endDate: {type: Date, required: true},
    productIds: {type: Array, ref: 'ProductWithBase', default: []},
})

const PromotionWithBaseSchema = new mongoose.Schema({
    ...PromotionSchema.obj,
    ...BaseSchema.obj
})

export const PromotionWithBase = mongoose.model('PromotionWithBase', PromotionWithBaseSchema, 'promotions');