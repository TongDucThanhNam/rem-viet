import mongoose, {Schema} from "mongoose";

export const OrderSchema = new mongoose.Schema({
    userId: {type: Schema.Types.ObjectId, ref: 'UserWithBase', required: true},
    products: {type: Array, ref: 'ProductWithBase', default: []},
    cartId: {type: Schema.Types.ObjectId, ref: 'CartWithBase', required: true},
    shipping: {type: Object},
    payment: {type: Object},
})