import { Category } from "../models/category.model.js";
import { ErrorResponse, SucessResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";





const createCategory = asyncHandler(async(req,res)=>{
        const {category} = req.body

        if(!category){
            return res.status(400)
            .json(ErrorResponse(400,"category is required"))
        }

        if(!req.file){
            return res.status(400).json(ErrorResponse(400,"req file is require"))
        }

        const categoryLocalPath = req.file?.path

        const categoryImage = await uploadOnCloudinary(categoryLocalPath)

        if(!categoryImage?.url){
            return res.status(400).json(ErrorResponse(400,"cloudinary url is required"))
            
        }


        await Category.create({
            category,
            categoryImage:{
                publicId:categoryImage?.public_id,
                url:categoryImage?.url
            }
        })


        return res.status(201)
        .json(SucessResponse(201,{},"category is created successfully"))


})



const fetchCategoryProduct = asyncHandler(async(req,res)=>{
     const {category} = req.params

     if(!category){
        return res.status(400).json(ErrorResponse(404,"this category not Found"))
     }

     const CategoryItem = await Category.aggregate([
        {
            $match:{
                category:category?.toLowerCase()
            }
        },

        {
            $lookup:{
                from: "products",
                localField: "_id",
                foreignField: "category",
                as: "category_product"
            }
        },

        {
            $project:{
                category_product:1
            }
        }

     ])


     if(!CategoryItem.length){
        return res.status(404).json(ErrorResponse(404,"Category Item not Found"))
     }


    return res.status(200).json({CategoryItem:CategoryItem[0]})



})



export {
    createCategory,
    fetchCategoryProduct
}