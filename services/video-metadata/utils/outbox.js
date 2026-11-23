import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import OutboxEvent from "../../shared/models/outbox.model.js";
import { publishEvent } from "../../shared/config/rabbitmq.js";

export const recordEvent = (session, routingKey, payload) =>
  OutboxEvent.create([{ routingKey, payload }], { session });

export const withEventTransaction = async (work) => {
  for (let attempt = 0; ; attempt++) {
    try {
      return await mongoose.connection.transaction(work, { writeConcern: { w: "majority" } });
    } catch (error) {
      if (error.code !== 11000 || attempt >= 2) throw error;
    }
  }
};

const deliver = async () => {
  const claim = randomUUID();
  const now = new Date();
  const event = await OutboxEvent.findOneAndUpdate(
    { availableAt: { $lte: now } },
    { $set: { claim, availableAt: new Date(+now + 60_000) }, $inc: { attempts: 1 } },
    { sort: { availableAt: 1, _id: 1 }, new: true },
  ).lean();
  if (!event) return false;

  const eventId = String(event._id);
  const sent = await publishEvent(event.routingKey, {
    ...event.payload, eventId, occurredAt: event.occurredAt.toISOString(),
  }, { messageId: eventId });
  const filter = { _id: event._id, claim };
  if (sent) {
    await OutboxEvent.updateOne(filter, {
      $unset: { availableAt: "", claim: "" },
      $set: { expiresAt: new Date(Date.now() + 7 * 86_400_000) },
    });
  } else {
    if ([1, 4, 16, 64].includes(event.attempts)) console.warn(`[outbox] Event ${eventId} remains pending after ${event.attempts} attempts.`);
    const delay = Math.min(300_000, 1000 * 2 ** Math.min(event.attempts, 9));
    await OutboxEvent.updateOne(filter, {
      $unset: { claim: "" },
      $set: { availableAt: new Date(Date.now() + delay + Math.floor(Math.random() * 1000)) },
    });
  }
  return sent;
};

export const startOutbox = () => {
  const poll = async () => {
    try {
      for (let i = 0; i < 10 && await deliver(); i++) {}
    } catch (error) {
      console.error("[outbox]", error.message);
    } finally {
      setTimeout(poll, 1000);
    }
  };
  void poll();
};
