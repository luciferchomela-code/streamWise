import { getRedisClient } from "./redisCache.js";
import { Notice } from "../models/community.js";
import Channel from "../../shared/models/channel.model.js";
import Video from "../../shared/models/video.model.js";
import Subscription from "../../shared/models/channelInteraction.model.js";
import { consumeQueue } from "../../shared/config/rabbitmq.js";

export async function signal(room, event, value) {
  const redis = await getRedisClient();
  if (redis) await redis.publish("streamwise:community", JSON.stringify({room,event,value}));
}

async function deliver(e) {
  const save = async (recipient, message, path) => {
    if (String(recipient) === e.userId) return;
    await Notice.updateOne({recipient: String(recipient), eventId: e.eventId}, {$setOnInsert:{message,path}}, {upsert:true});
    await signal("user:"+recipient, "inbox", null);
  };
  if (e.event === "video.finalized") {
    if (e.visibility !== "public" || !await Video.exists({_id:e.videoId, visibility:"public",status:{$in:["published","ready"]}})) return;
    const subscribers = Subscription.find({channelId:e.channelId, subscribed:true, createdAt:{$lte:new Date(e.occurredAt)}}).select("userId").lean().cursor();
    await subscribers.eachAsync(async batch => {
      const recipients = batch.map(sub => String(sub.userId)).filter(id => id !== String(e.userId));
      if (!recipients.length) return;
      await Notice.bulkWrite(recipients.map(recipient => ({
        updateOne: {
          filter: {recipient, eventId: e.eventId},
          update: {$setOnInsert: {message: "New video: "+e.title, path: "/watch/"+e.videoId}},
          upsert: true
        }
      })), {ordered: false});
      await Promise.all(recipients.map(id => signal("user:"+id, "inbox", null)));
    }, {batchSize: 100});
    return;
  }
  if (e.event === "channel.subscribed") return save(e.ownerId,"Someone subscribed to your channel.","/studio");
  if (!e.liked && !e.disliked && e.event !== "video.commented") return;
  const video = await Video.findById(e.videoId).select("channelId title");
  const channel = video && await Channel.findById(video.channelId).select("ownerId");
  if (channel) await save(channel.ownerId, "Someone "+e.event.split(".")[1]+(e.event === "video.commented" ? " on " : " ")+video.title, "/watch/"+video.id);
}
export function startNotifications() {
  const run = async () => {
    try {
      await consumeQueue({name:"streamwise.notifications.v1", routingKey:["video.finalized","video.liked","video.disliked","video.commented","channel.subscribed"]},
        (ch,msg) => { void deliver(JSON.parse(msg.content)).then(()=>ch.ack(msg)).catch(error=>{
          console.warn("[notifications]",error.message);
          setTimeout(()=>{try {ch.nack(msg,false,true);} catch {}},2000);
        }); }, ()=>setTimeout(run,3000));
    } catch { setTimeout(run,3000); }
  };
  void run();
}
