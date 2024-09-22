import {Schema} from "mongoose";

const CartSchema = new Schema({
    userId: {type: Schema.Types.ObjectId, ref: 'UserWithBase', required: true},
    products: {type: Array, ref: 'ProductWithBase', default: []},
})