import mongoose from "mongoose";

const { Schema } = mongoose;

const videoSchema = new Schema({
    name:{
        type:String,
        required:true
    },
    owner:{
        type:Schema.Types.ObjectId,
        ref:"User",
        required:true
    },
    likes:{
        type:[Schema.Types.ObjectId],
        ref:"User",
        default:[]
    },
    dislikes:{
        type:[Schema.Types.ObjectId],
        ref:"User",
        default:[]
    },
    views:{
        type:Number,
        default:0
    },
    description:{
        type:String,
        required:true
    },
    thumbnail:{
        type:String,
        required:true
    },
    videoUrl:{
        type:String,
        required:true
    },
    duration:{
        type:Number,
        required:true
    },
    tags:{
        type:[String],
        default:[]
    },
    category:{
        type:String,
        required:true
    },
    visibility:{
        type:String,
        enum:["public","private","unlisted"],
        default:"public"
    },
    comments:{
        type:[Schema.Types.ObjectId],
        ref:"Comment",
        default:[]
    },
    playlist:{
        type:[Schema.Types.ObjectId],
        ref:"Playlist",
        default:[]
    },
    subscribers:{
        type:[Schema.Types.ObjectId],
        ref:"User",
        default:[]
    }
},{
    timestamps:true
});

const Video = mongoose.model("Video", videoSchema);

export default Video;