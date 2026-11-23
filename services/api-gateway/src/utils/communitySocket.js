import { Server } from "socket.io";
import { verifyGatewaySignature } from "./gatewaySignature.js";
import { isAuth } from "../middleware/isAuth.js";
import { parseCookies } from "../middleware/parseCookies.js";
import { isAllowedBrowserOrigin } from "./browserOrigins.js";
export function attachCommunity(server, redis, app) {
  const io = new Server(server, { transports:["websocket"], allowRequest:(req,cb)=>cb(null,isAllowedBrowserOrigin(req.headers.origin)) });
  io.use((socket,next)=>{
    const req = socket.request;
    req.app = app;
    parseCookies(req,{},()=>isAuth(req,{status(){return this;},json(){next(new Error("Sign in required"));}},()=>{
      socket.data.user = String(req.auth.userId);
      next();
    }));
  });
  io.on("connection",socket=>{
    socket.join("user:"+socket.data.user);
    socket.on("follow",(ticket)=>{
      const {room,timestamp,signature}=ticket||{};
      if (typeof room !== "string" || !/^(party|live):[a-f0-9]{24}$/.test(room)) return;
      if (typeof signature !== "string" || !Number.isSafeInteger(Number(timestamp))) return;
      if(!verifyGatewaySignature({userId:"community-room/"+socket.data.user,requestId:room,timestamp,signature})) return;
      if (socket.data.following) socket.leave(socket.data.following);
      socket.data.following = room;
      socket.join(room);
    });
  });
  const sub = redis.duplicate();
  sub.on("error", e=>console.warn("[community]",e.message));
  sub.connect().then(()=>sub.subscribe("streamwise:community", raw=>{
    const {room,event,value} = JSON.parse(raw);
    io.to(room).emit(event,value);
  })).catch(e=>console.warn("[community]",e.message));
}
