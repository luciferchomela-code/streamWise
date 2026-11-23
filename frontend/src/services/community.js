import { useEffect, useRef } from 'react';
import { API_BASE_URL } from './apiFetch';
import { featureRequest } from './featuresService';
const origin = new URL(API_BASE_URL,location.origin).origin;
let library;
function loadSocket() {
  if (!library) library=new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src=origin+'/socket.io/socket.io.js';
    script.onload=()=>resolve(window.io);
    script.onerror=()=>{library=null;script.remove();reject(new Error('Realtime unavailable'));};
    document.head.appendChild(script);
  });
  return library;
}
export const community=(path,options)=>featureRequest('/community'+path,options);
export function useUpdates(room,event,refresh,enabled=true,onMessage) {
  const latest=useRef(refresh),listener=useRef(onMessage);
  useEffect(()=>{listener.current=onMessage;},[onMessage]);
  useEffect(()=>{latest.current=refresh;},[refresh]);
  useEffect(()=>{
    if(!enabled)return;
    let active=true,socket,pending=false,again=false;
    async function update(){
      if(pending){again=true;return;}
      pending=true;
      try{const ticket=await latest.current();if(active&&socket?.connected&&ticket?.room===room)socket.emit('follow',ticket);}finally{pending=false;if(active&&again){again=false;void update();}}
    }
    void update();
    const timer=setInterval(update,15000);
    loadSocket().then(io=>{
      if(!active)return;
      socket=io(origin,{transports:['websocket'],withCredentials:true});
      socket.on('connect',()=>{void update();});
      socket.on(event,value=>{if(value&&listener.current)listener.current(value);else void update();});
    }).catch(()=>{});
    return ()=>{active=false;clearInterval(timer);socket?.disconnect();};
  },[room,event,enabled]);
}
