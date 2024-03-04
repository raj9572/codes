
import { v2 as cloudinary } from 'cloudinary'
import fs from 'fs'


cloudinary.config({
    cloud_name: process.env.CLOUDINARY_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_SECRET
});


const uploadOnCloudinary = async (localFilePath) => {
    try {
        if (!localFilePath) return null

        // upload the file on cloudinary
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto",
            folder:"codeswear Images"
        })
        // file has been uploaded successfully
        // console.log("file is uploaded on cloudinary",response)
        fs.unlinkSync(localFilePath)
        return response
    } catch (error) {
        fs.unlinkSync(localFilePath) // remove the locally saved temporary file as the upload operation got failed
        return null
    }
}


const deleteOnCloudinary = async(publicId)=>{
    try {

        if(!publicId)  return null

        const response = await cloudinary.api.delete_resources([`${publicId}`])
        
        return response
    } catch (error) {
        console.log('error while deleting from cloudinary',error)
        return null
    }
}

export { uploadOnCloudinary,deleteOnCloudinary }
