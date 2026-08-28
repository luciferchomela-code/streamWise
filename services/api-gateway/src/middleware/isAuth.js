import jwt from "jsonwebtoken"

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

        if(!decodedValue || decodedValue.type !== "access" || !decodedValue.userId){
            return res.status(401).json({
                message:"invalid token"
            })
        }

        req.auth = {
            userId: decodedValue.userId,
            email: decodedValue.email,
        }

        next()

    }catch(error){
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                message: "Access token expired"
            })
        }
        res.status(401).json({
            message:"invalid access token"
        })
    }
}
