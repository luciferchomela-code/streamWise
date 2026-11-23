import mongoose from "mongoose";

const schema = new mongoose.Schema({
  routingKey: { type: String, required: true },
  payload: { type: Object, required: true },
  occurredAt: { type: Date, default: Date.now },
  availableAt: { type: Date, default: Date.now },
  attempts: { type: Number, default: 0 },
  claim: String,
  expiresAt: { type: Date, expires: 0 },
});
schema.index({ availableAt: 1, _id: 1 }, { partialFilterExpression: { availableAt: { $type: "date" } } });

export default mongoose.model("OutboxEvent", schema);
