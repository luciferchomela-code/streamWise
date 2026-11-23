import { Live } from "../models/community.js";
import Video from "../../shared/models/video.model.js";
import Channel from "../../shared/models/channel.model.js";
import { recordEvent, withEventTransaction } from "./outbox.js";
async function mux(path,method="GET",body) {
  const {MUX_TOKEN_ID:id,MUX_TOKEN_SECRET:secret}=process.env;
  if(!id||!secret) throw Object.assign(new Error("Live streaming requires Mux credentials"),{status:503});
  const res=await fetch("https://api.mux.com/video/v1/"+path,{method,headers:{Authorization:"Basic "+Buffer.from(id+":"+secret).toString("base64"),"Content-Type":"application/json"},body:body&&JSON.stringify(body),signal:AbortSignal.timeout(8000)});
  if(!res.ok) throw Object.assign(new Error("Streaming provider unavailable ("+res.status+")"),{status:502});
  return (await res.json().catch(()=>({}))).data;
}
export async function createBroadcast(owner,title) {
  const stream=await mux("live-streams","POST",{playback_policies:["public"],new_asset_settings:{playback_policies:["public"]},reconnect_window:60});
  try { return await Live.create({owner,title,provider:stream.id,playback:stream.playback_ids[0].id}); }
  catch(error){await mux("live-streams/"+stream.id,"DELETE");throw error;}
}
async function owned(id,owner){
  const live=await Live.findOne({_id:id,owner});
  if(!live)throw Object.assign(new Error("Broadcast unavailable"),{status:404});
  return live;
}
export async function credentials(id,owner){
  const live=await owned(id,owner);
  const stream=await mux("live-streams/"+live.provider);
  return {server:"rtmps://global-live.mux.com:443/app",key:stream.stream_key};
}
export async function endBroadcast(id,owner){
  const live=await owned(id,owner);
  if(live.status==="ended")return;
  await mux("live-streams/"+live.provider+"/disable","PUT");
  await Live.updateOne({_id:id,status:{$ne:"ended"}},{status:"processing",checked:new Date()});
}
async function reconcile(){
  const now=Date.now();
  const live=await Live.findOneAndUpdate({status:{$in:["live","waiting","processing"]},checked:{$lte:new Date(now)}},{checked:new Date(now+15000)},{sort:{checked:1},new:true});
  if(!live)return;
  const filter={_id:live.id,status:live.status,checked:live.checked};
  const stream=await mux("live-streams/"+live.provider);
  if(stream.status==="active"){
    if(live.status!=="processing")await Live.updateOne(filter,{status:"live",asset:stream.active_asset_id});
    return;
  }
  const assetId=live.asset||stream.recent_asset_ids?.[0];
  if(!assetId){
    if(stream.status==="disabled")await Live.updateOne(filter,{status:"ended"});
    return;
  }
  if(stream.status!=="disabled")await mux("live-streams/"+live.provider+"/disable","PUT");
  const asset=await mux("assets/"+assetId);
  if(asset.status==="errored"){await Live.updateOne(filter,{status:"failed"});return;}
  if(asset.status!=="ready"||!asset.playback_ids?.length){await Live.updateOne(filter,{status:"processing",asset:assetId});return;}
  const channel=await Channel.findOne({ownerId:live.owner});
  if(!channel){await Live.updateOne(filter,{status:"failed"});return;}
  const playback=asset.playback_ids[0].id;
  await withEventTransaction(async session=>{
    if(!(await Live.updateOne(filter,{status:"ended",replay:live.id},{session})).modifiedCount)return;
    const url="https://stream.mux.com/"+playback+".m3u8";
    await Video.create([{_id:live._id,channelId:channel._id,title:live.title,description:"Live broadcast recording",visibility:"public",status:"ready",hlsUrl:url,videoUrl:url,duration:asset.duration,thumbnailUrl:"https://image.mux.com/"+playback+"/thumbnail.jpg"}],{session});
    await recordEvent(session,"video.finalized",{videoId:live.id,title:live.title,channelId:channel.id,ownerId:live.owner,visibility:"public",status:"ready",duration:asset.duration});
  });
}
export function startBroadcasts(){
  const poll=async()=>{try{await reconcile();}catch(e){console.warn("[broadcast]",e.message);}finally{setTimeout(poll,1500);}};
  void poll();
}
