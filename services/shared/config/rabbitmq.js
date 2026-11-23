import { randomUUID } from "node:crypto";
import amqp from "amqplib";

let connectionPromise;
let channelPromise;
const pending = new Map();
const queueBindings = new WeakMap();

const getConnection = () => {
  if (!connectionPromise) {
    connectionPromise = amqp.connect(process.env.RABBITMQ_URL || "amqp://localhost", { timeout: 5000 })
      .then((connection) => {
        connection.on("error", (error) => console.warn("[RabbitMQ]", error.message));
        connection.once("close", () => { connectionPromise = undefined; });
        return connection;
      })
      .catch((error) => { connectionPromise = undefined; throw error; });
  }
  return connectionPromise;
};

const getChannel = () => {
  if (!channelPromise) {
    channelPromise = getConnection().then(async (connection) => {
      const channel = await connection.createConfirmChannel();
      channel.on("error", (error) => console.warn("[RabbitMQ]", error.message));
      channel.once("close", () => { channelPromise = undefined; });
      channel.on("return", (message) => {
        pending.get(message.properties.correlationId)?.(false);
      });
      const exchange = process.env.RABBITMQ_EXCHANGE || "youtube.events";
      await channel.assertExchange(exchange, "topic", { durable: true });
      return { channel, exchange };
    }).catch((error) => { channelPromise = undefined; throw error; });
  }
  return channelPromise;
};

const bindQueue = async (channel, exchange, { name, routingKey, options }) => {
  await channel.assertQueue(name, { durable: true, ...options });
  for (const key of [].concat(routingKey)) await channel.bindQueue(name, exchange, key);
};

export const consumeQueue = async (queue, onMessage, onClose) => {
  const connection = await getConnection();
  const channel = await connection.createChannel();
  channel.on("error", (error) => console.warn("[RabbitMQ]", error.message));
  try {
    const exchange = process.env.RABBITMQ_EXCHANGE || "youtube.events";
    await channel.assertExchange(exchange, "topic", { durable: true });
    await bindQueue(channel, exchange, queue);
    await channel.prefetch(1);
    await channel.consume(queue.name, (message) => {
      if (message) onMessage(channel, message);
      else void channel.close().catch(() => {});
    });
    channel.once("close", onClose);
  } catch (error) {
    await channel.close().catch(() => {});
    throw error;
  }
};

export const publishEvent = async (routingKey, payload, { messageId, queue } = {}) => {
  try {
    const { channel, exchange } = await getChannel();
    if (queue) {
      if (!queueBindings.has(channel)) queueBindings.set(channel, new Map());
      const bindings = queueBindings.get(channel);
      if (!bindings.has(queue.name)) {
        bindings.set(queue.name, bindQueue(channel, exchange, queue).catch((error) => {
          bindings.delete(queue.name);
          throw error;
        }));
      }
      await bindings.get(queue.name);
    }
    const correlationId = randomUUID();
    const body = Buffer.from(JSON.stringify({ ...payload, event: routingKey, version: payload.version || 1 }));
    return await new Promise((resolve) => {
      const finish = (sent) => {
        clearTimeout(timeout);
        pending.delete(correlationId);
        resolve(sent);
      };
      const timeout = setTimeout(() => finish(false), 10_000);
      pending.set(correlationId, finish);
      try {
        channel.publish(exchange, routingKey, body, {
          persistent: true, mandatory: true, contentType: "application/json", messageId, correlationId,
        }, (error) => finish(!error));
      } catch {
        finish(false);
      }
    });
  } catch (error) {
    console.warn("[RabbitMQ] Publish unavailable:", error.message);
    return false;
  }
};
