import amqp from "amqplib";

const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://localhost";
const EXCHANGE_NAME = process.env.RABBITMQ_EXCHANGE || "youtube.events";

let connectionPromise = null;
let channelPromise = null;

const getConnection = async () => {
  if (!connectionPromise) {
    connectionPromise = amqp.connect(RABBITMQ_URL).catch((error) => {
      connectionPromise = null;
      throw error;
    });
  }

  return connectionPromise;
};

const getChannel = async () => {
  if (!channelPromise) {
    channelPromise = (async () => {
      const connection = await getConnection();
      const channel = await connection.createConfirmChannel();
      await channel.assertExchange(EXCHANGE_NAME, "topic", { durable: true });
      return channel;
    })().catch((error) => {
      channelPromise = null;
      throw error;
    });
  }

  return channelPromise;
};

export const publishEvent = async (routingKey, payload = {}, options = {}) => {
  if (!routingKey) {
    throw new Error("RabbitMQ routingKey is required.");
  }

  try {
    const channel = await getChannel();
    const message = Buffer.from(
      JSON.stringify({
        ...payload,
        event: routingKey,
        occurredAt: payload.occurredAt || new Date().toISOString(),
        version: payload.version || 1,
      })
    );

    channel.publish(EXCHANGE_NAME, routingKey, message, {
      persistent: true,
      ...options,
    });

    await channel.waitForConfirms();
    return true;
  } catch (error) {
    console.warn(`[RabbitMQ] Failed to publish "${routingKey}":`, error.message);
    return false;
  }
};
