import { User } from "../models/user.model.js"
import { ErrorResponse, SucessResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"




const generateAccessAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId)
        return {
            AccessToken: async function () {
                const accessToken = await user.generateAccessToken()
                return accessToken
            },
            RefreshToken: async function () {
                const refreshToken = await user.generateRefreshToken()
                user.refreshToken = refreshToken
                await user.save({ validateBeforeSave: false })
                return refreshToken
            }
        }
    } catch (error) {
        return res.status(500).json(ErrorResponse(500, "error while generate access and refresh token"))
    }
}



const registerUser = asyncHandler(async (req, res) => {
    const { username, fullName, email, password } = req.body

    if ([fullName, email, username, password].some((field) => field?.trim() === "")) {
        return res.status(400).json(ErrorResponse(400, "All the fields are required"))

    }

    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (existedUser) {
        return res.status(409).json(ErrorResponse(400, "user is already exit"))

    }

    const user = await User.create({
        fullName, email, password,
        username: username?.toLowerCase()
    })

    const createdUser = await User.findById(user._id).select("-password -refreshToken")


    if (!createdUser) {
        return res.status(500).json(ErrorResponse(500, "something went wronge while register a user"))

    }

    return res.status(201)
        .json(SucessResponse(
            201,
            createdUser,
            "user is created successfully"
        ))
})


// const registerUser = async(req,res)=>{
//       try {

//         const {username,fullName,email,password} = req.body

//         if([fullName, email, username, password].some((field) => field?.trim() === "")){
//             return res.status(400).json(ErrorResponse(400,"All the fields are required"))

//         }

//         const existedUser = await User.findOne({
//             $or: [{username},{email}]
//         })

//         if(existedUser){
//             return res.status(409).json(ErrorResponse(400,"user is already exit"))

//         }

//         const user = await User.create({
//             fullName,email,password,
//             username:username.toLowerCase()
//         })

//          const createdUser = await User.findById(user._id).select("-password -refreshToken")


//          if (!createdUser) {
//             return res.status(500).json(ErrorResponse(500,"something went wronge while register a user"))

//         }

//         return res.status(201)
//         .json(SucessResponse(
//             201,
//             createdUser,
//             "user is created successfully"
//         ))

//       } catch (error) {
//          res.status(error.code || 500)
//          .json(ErrorResponse(500,error.message || "interner server error"))
//       }
// }




const loginUser = async (req, res) => {
    try {

        const { username, email, password } = req.body

        if (!username && !email) {
            return res.status(400)
                .json(ErrorResponse(400, "username or email is required"))
        }

        const user = await User.findOne({
            $or: [{ username }, { email }]
        })

        if (!user) {
            return res.status(404).json(ErrorResponse(404, " user doesnot credential"))
        }

        const isPasswordMatch = await user.isPasswordCorrect(password)

        if (!isPasswordMatch) {
            return res.status(404).json(ErrorResponse(404, " invalid user credential"))
        }


        const store = await generateAccessAndRefreshToken(user._id)
        const accessToken = await store.AccessToken()
        const refreshToken = await store.RefreshToken()

        const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

        const options = {
            httpOnly: true,
            secure: true
        }

        return res.status(200)
            .cookie("refreshToken", refreshToken, options)
            .cookie("accessToken", accessToken, options)
            .json(SucessResponse(
                200,
                {
                    user: loggedInUser, accessToken, refreshToken
                },
                "user is login successfully"
            ))



    } catch (error) {
        return res.status(500)
            .json(ErrorResponse(500, error.message || "interner server error"))
    }
}



const logoutUser = async (req, res) => {
    try {
        await User.findByIdAndUpdate(
            req.user?._id,
            {
                $unset: {
                    refreshToken: 1   // this remove the field from document
                }
            },
            {
                new: true
            }
        )

        const options = {
            httpOnly: true,
            secure: true
        }

        return res.status(200)
            .clearCookie("accessToken", options)
            .clearCookie("refreshToken", options)
            .json(SucessResponse(200, "user logged out"))


    } catch (error) {
        res.status(500)
            .json(ErrorResponse(500, error.message || "interner server error"))

    }

}



const refreshAccessToken = async (req, res) => {
    try {

        const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken
        if (!incomingRefreshToken) {
            return res.status(401).json(ErrorResponse(401, "unauthorized request"))
        }

        try {
            const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)

            const user = await User.findById(decodedToken._id)

            if (!user) {
                return res.status(401).json(ErrorResponse(401, "Invalid refresh token"))

            }

            if (incomingRefreshToken !== user?.refreshToken) {

                return res.status(401).json(ErrorResponse(401, "Refresh token is expired or used"))
            }

            const options = {
                httpOnly: true,
                secure: true
            }

            // const { accessToken, newRefreshToken } = await generateAccessAndRefreshToken(user._id)
            const store = await generateAccessAndRefreshToken(user._id)
            const accessToken = await store.AccessToken()

            return res.status(200)
                .cookie("accessToken", accessToken, options)
                .json(SucessResponse(
                    200,
                    accessToken,
                    "Access token refreshed"
                ))


        } catch (error) {
            return res.status(401)
                .json(ErrorResponse(401, error?.message || "invalid refresh Token"))
        }

    } catch (error) {
        res.status(500)
            .json(ErrorResponse(500, error.message || "interner server error"))
    }
}



const updateCurrentPassword = asyncHandler(async(req,res)=>{
    const { oldPassword, newPassword } = req.body

    const user = await User.findById(req.user?._id)

    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if (!isPasswordCorrect) {
        return res.status(400)
        .json(ErrorResponse(400,"Invalid old Password"))
    }

    user.password = newPassword

    await user.save({ validateBeforeSave: false })

    return res.status(200)
        .json(SucessResponse(200, {}, "Password Changed Successfully"))


})


const getCurrentUser = asyncHandler(async(req,res)=>{
    
    return res.status(200)
        .json(SucessResponse(200, req.user, "Current user fetched successfully"))
})


const updateAccountDetails = asyncHandler(async(req,res)=>{
    // console.log(req.body)
    const { fullName, email,username } = req.body

    if (!fullName && !email && !username) {
        return res.status(400).json(ErrorResponse(400,"Atlease one fields are required"))
    }

    let user = await User.findById(req.user?._id)

    if(email){
        const existUser = await User.findOne({email:email})
        if(existUser){
        return res.status(403).json(ErrorResponse(403,"email already exist"))
        }

        user.email = email

     }

    if(username){
        const existUser = await User.findOne({username:username})
        if(existUser){
        return res.status(403).json(ErrorResponse(403,"username already exist"))
        }

        user.username = username
    }

    if(fullName){
        user.fullName = fullName
    }


   const updatedUser = await user.save({validateBeforeSave:false})

     
            
    return res.status(200)
        .json(SucessResponse(200, updatedUser, "Account Details Updated Successfully"))

})


const getAllUsers = asyncHandler(async(req,res)=>{

    const users = await User.find({})

    if(!users){
        return res.status(404).json(ErrorResponse(404,"Users Not Found"))
    }

    return res.status(200)
    .json(SucessResponse(200,users,"user fetched successfully"))

})



const deleteUser = asyncHandler(async (req,res)=>{
       const userId = req.params.userId

       const user = await User.findById(userId)
       
       if(!user){
        return res.status(404)
        .json(ErrorResponse(404,"user Not Found"))
       }

       const deletedUser = await User.findByIdAndDelete(user._id)

    //    console.log(deletedUser)

       return res.status(200)
       .json(SucessResponse(200,deletedUser,"user delete successfully"))


})


const makeUserAdmin = asyncHandler(async(req,res)=>{
        const userId = req.params.userId

        const user = await User.findById(userId)

        if(!user){
            return res.status(404)
            .json(ErrorResponse(404,"user Not Found"))
        }

        if(user.isAdmin === "ADMIN"){
            user.isAdmin = "NORMAL"
        }  else{
            user.isAdmin = "ADMIN"
        }
        

        const updateAdminuser = await user.save({validateBeforeSave:false})

        return res.status(203)
        .json(SucessResponse(203,updateAdminuser,"user updated successfully"))
        // if(!userId){
        //     return res.status(400)
        //     .json(ErrorResponse(400,"userId is required"))
        // }

        // const user = await User.findByIdAndUpdate(user._id,
        //        {
        //          $set:{
        //             isAdmin:"Admin"
        //         }
        //        }
        //     )

        

})




export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    updateCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    getAllUsers,
    deleteUser,
    makeUserAdmin
}