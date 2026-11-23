import mongoose from "mongoose";

const guestViewSchema = new mongoose.Schema({
  _id: String,
  expiresAt: { type: Date, required: true, expires: 0 },
});

export default mongoose.model("GuestView", guestViewSchema);
