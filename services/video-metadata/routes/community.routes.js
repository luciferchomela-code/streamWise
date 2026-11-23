import { Router } from "express";
import handler from "../middlewares/tryCatch.js";
import { requireGatewayIdentity } from "../middlewares/requireGatewayIdentity.js";
import { Party, Notice, Live, Chat } from "../models/community.js";
import { findPlayableVideo } from "../utils/videoAccess.js";
import { signal } from "../utils/communityEvents.js";
import { createBroadcast, credentials, endBroadcast } from "../utils/broadcast.js";
import User from "../../shared/models/user.model.js";
import Channel from "../../shared/models/channel.model.js";
import { createGatewaySignature } from "../../shared/utils/gatewaySignature.js";
function ticket(req,room) {
  const timestamp=Date.now();
  return {room,timestamp,signature:createGatewaySignature({userId:"community-room/"+req.auth.userId,requestId:room,timestamp})};
}
const router = Router();
router.use(requireGatewayIdentity, (req,res,next)=>{res.set("Cache-Control","private, no-store"); next();});
router.param("id",(req,res,next,id)=> /^[a-f0-9]{24}$/.test(id)?next():res.sendStatus(400));
const fail = (status,message)=>{throw Object.assign(new Error(message),{status});};
const wake = (room,event)=>signal(room,event,null).catch(e=>console.warn("[community]",e.message));
router.get("/inbox",handler(async(req,res)=>{
  const filter={recipient:req.auth.userId};
  const before=req.query.before;
  if (before && !/^[a-f0-9]{24}$/.test(before)) fail(400,"Invalid cursor");
  const [items,unread]=await Promise.all([Notice.find({...filter,...(before?{_id:{$lt:before}}:{})}).sort({_id:-1}).limit(30),Notice.countDocuments({...filter,read:false})]);
  res.json({items,unread});
}));
router.patch("/inbox/:id",handler(async(req,res)=>{
  await Notice.updateOne({_id:req.params.id,recipient:req.auth.userId},{read:true});
  await wake("user:"+req.auth.userId,"inbox");res.sendStatus(204);
}));
router.post("/party",handler(async(req,res)=>{
  const v=await findPlayableVideo(req.body.videoId,req.auth.userId);
  if (!v) fail(404,"Video unavailable");
  const party=await Party.create({host:req.auth.userId,videoId:v.id,position:0,playing:false,version:0,changed:Date.now(),expires:new Date(Date.now()+86400000)});
  res.status(201).json({id:party.id});
}));
async function membership(req){
  let party=await Party.findOne({_id:req.params.id,expires:{$gt:new Date()}});
  if(party?.playing && Date.now()-party.hostSeen>45000) {
    const deadline=party.hostSeen+45000;
    await Party.updateOne({_id:party.id,version:party.version,hostSeen:party.hostSeen},{$set:{playing:false,position:party.position+Math.max(0,deadline-party.changed)/1000,changed:deadline},$inc:{version:1}});
    party=await Party.findById(party.id);
  }
  const video=party && await findPlayableVideo(party.videoId,req.auth.userId);
  if (!video) fail(404,"Party or video unavailable");
  return {party,video};
}
router.get("/party/:id",handler(async(req,res)=>{
  const {party,video}=await membership(req);
  res.json({ticket:ticket(req,"party:"+party.id),party,serverTime:Date.now(),isHost:party.host===req.auth.userId,title:video.title,url:video.hlsUrl||video.videoUrl});
}));
router.post("/party/:id/presence",handler(async(req,res)=>{
  const cutoff=Date.now()-45000;
  await Party.updateOne({_id:req.params.id,host:req.auth.userId,playing:true,hostSeen:{$gte:cutoff}},{$set:{hostSeen:Date.now()}});
  res.sendStatus(204);
}));
router.patch("/party/:id",handler(async(req,res)=>{
  const {party,video}=await membership(req);
  if(party.host!==req.auth.userId) fail(403,"Host controls playback");
  const {position,playing,version}=req.body;
  if(!Number.isFinite(position)||position<0||typeof playing!=="boolean"||!Number.isInteger(version)) fail(400,"Invalid playback command");
  const changed=Date.now();
  const updated=await Party.findOneAndUpdate({_id:party.id,version},{$set:{changed,hostSeen:changed,playing,position:Math.min(position,video.duration??position)},$inc:{version:1}},{new:true});
  if(!updated) fail(409,"Playback changed. Try again.");
  await wake("party:"+party.id,"party");res.json({party:updated,serverTime:Date.now()});
}));
router.get("/live",handler(async(req,res)=>{
  res.json({items:await Live.find({$or:[{owner:req.auth.userId},{status:{$in:["live","ended"]}}]}).select("title status replay owner").sort({_id:-1}).limit(50)});
}));
router.post("/live",handler(async(req,res)=>{
  const title=(typeof req.body.title==="string" && req.body.title.trim());
  if(!title||title.length>160) fail(400,"Enter a title up to 160 characters");
  const channel=await Channel.findOne({ownerId:req.auth.userId});
  if(!channel) fail(403,"Create a channel first");
  const broadcast=await createBroadcast(req.auth.userId,title);
  res.status(201).json({id:broadcast.id});
}));
router.get("/live/:id",handler(async(req,res)=>{
  const live=await Live.findById(req.params.id);
  if(!live) fail(404,"Broadcast unavailable");
  const messages=await Chat.find({room:live.id}).sort({_id:-1}).limit(80);
  res.json({ticket:ticket(req,"live:"+live.id),title:live.title,status:live.status,isHost:live.owner===req.auth.userId,url:"https://stream.mux.com/"+live.playback+".m3u8",replay:live.replay,messages:messages.reverse()});
}));
router.get("/live/:id/key",handler(async(req,res)=>res.json(await credentials(req.params.id,req.auth.userId))));
router.post("/live/:id/end",handler(async(req,res)=>{await endBroadcast(req.params.id,req.auth.userId);res.sendStatus(204);}));
router.post("/live/:id/chat",handler(async(req,res)=>{
  const body=typeof req.body.body==="string" && req.body.body.trim();
  if(!body||body.length>500) fail(400,"Enter up to 500 characters");
  if(!await Live.exists({_id:req.params.id,status:"live"})) fail(409,"Chat is open during the broadcast");
  const user=await User.findById(req.auth.userId).select("name");
  const message=await Chat.create({room:req.params.id,author:req.auth.userId,name:user?.name||"Viewer",body});
  await signal("live:"+req.params.id,"chat",message).catch(e=>console.warn("[live-chat]",e.message));res.sendStatus(204);
}));
export default router;
