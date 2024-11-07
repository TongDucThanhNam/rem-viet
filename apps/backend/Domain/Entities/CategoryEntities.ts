import mongoose from "mongoose";

export const CategorySchema = new mongoose.Schema({
    //Category Name
    name: {type: String, required: true},
});
