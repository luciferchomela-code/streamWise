import mongoose from "mongoose";

const channelInteractionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    channelId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Channel",
        required: true
    },
    subscribed:{
        type:Boolean,
        default:false
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

channelInteractionSchema.index({ userId: 1, channelId: 1 }, { unique: true });
channelInteractionSchema.index({ userId: 1, subscribed: 1 });

const ChannelInteraction = mongoose.model("ChannelInteraction", channelInteractionSchema);

export default ChannelInteraction;
