import jwt from "jsonwebtoken"
import User from "../../../shared/models/user.model.js"

export const isAuth = async (req,res,next)=>{
    try{
        const authHeader = req.headers.authorization

        if(!authHeader || !authHeader.startsWith("Bearer ")){
            return res.status(401).json({
                message:"please login"
            })
        }

        const token = authHeader.split(" ")[1]

        if(!token){
            return res.status(401).json({
                message:"please login"
            })
        }

        const decodedValue = jwt.verify(token,process.env.JWT_SEC)

        if(!decodedValue || !decodedValue.user){
            return res.status(401).json({
                message:"invalid token"
            })
        }

        req.user = decodedValue.user

        next()

    }catch(error){
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                message: "Access token expired"
            })
        }
        res.status(500).json({
            message:"please login - jwt error"
        })
    }
}