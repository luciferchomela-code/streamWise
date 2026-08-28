import mongoose from "mongoose";

const { Schema } = mongoose;

const userSchema = new Schema({
    name:{
        type:String,
        required:true
    },
    email:{
        type:String,
        required:true,
        unique:true
    },
    image:{
        type:String,
        required:true
    },
    channelId:{
        type:String,
        unique:true,
        sparse:true,
        index:true,
        default:null
    },
    subscriptions:{
        type:Number,
        default:0
    },
    likesGiven:{
        type:Number,
        default:0
    },
    watchHistory:[{
        type: Schema.Types.ObjectId,
        ref: "Video"
    }],
    refreshToken:{
        type:String
    }
},{
    timestamps:true
});

const User = mongoose.model("User", userSchema);

export default User;