import React,{useEffect,useRef,useState} from 'react';
import {Link,useNavigate,useParams} from 'react-router-dom';
import {useAuth} from '../../hooks/useAuth';
import {FeatureLayout,action,primary,panel,field} from './FeatureLayout';
import {community,useUpdates} from '../../services/community';

export function StartParty({videoId}){
  const nav=useNavigate(),[error,setError]=useState('');
  return <><button className={action} onClick={async()=>{try{const r=await community('/party',{method:'POST',body:{videoId}});nav('/party/'+r.id);}catch(e){setError(e.message);}}}>Start watch party</button>{error&&<span role="alert">{error}</span>}</>;
}
export function Bell(){
  const {user}=useAuth(),[count,setCount]=useState(0);
  useUpdates(null,'inbox',async()=>{try{setCount((await community('/inbox')).unread);}catch{}},Boolean(user));
  return user&&<Link to="/notifications" className={action} aria-label={'Notifications, '+count+' unread'}>Inbox {count>0&&count}</Link>;
}
export function Inbox(){
  const {user}=useAuth(),[items,setItems]=useState([]),[error,setError]=useState('');
  const nav=useNavigate();
  useUpdates(null,'inbox',async()=>{try{setItems((await community('/inbox')).items);}catch(e){setError(e.message);}},Boolean(user));
  return <FeatureLayout title="Notifications" error={error}><ul className={panel}>{items.map(n=><li key={n._id}><button className="w-full p-3 text-left" onClick={async()=>{try{await community('/inbox/'+n._id,{method:'PATCH'});nav(n.path);}catch(e){setError(e.message);}}}>{!n.read&&'● '}{n.message}</button></li>)}{!items.length&&<li>Your inbox is empty.</li>}</ul></FeatureLayout>;
}
function useMedia(ref,url){
  useEffect(()=>{
    const el=ref.current;if(!url||!el)return;
    let disposed=false,hls;
    if(!url.includes('.m3u8')||el.canPlayType('application/vnd.apple.mpegurl'))el.src=url;
    else import('hls.js/light').then(({default:Hls})=>{if(disposed)return;hls=new Hls();hls.loadSource(url);hls.attachMedia(el);});
    return ()=>{disposed=true;hls?.destroy();el.removeAttribute('src');el.load();};
  },[ref,url]);
}
export function PartyPage(){
  const {id}=useParams();return <Party key={id} id={id}/>;
}
function Party({id}){
  const {user}=useAuth(),media=useRef(),clock=useRef(),accepted=useRef(false);
  const [data,setData]=useState(null),[error,setError]=useState(''),[copied,setCopied]=useState(false),[joined,setJoined]=useState(false);
  const path='/party/'+id;
  async function refresh(){
    const start=performance.now();
    try{const value=await community(path);
      if(clock.current&&value.party.version<clock.current.party.version)return;
      clock.current={...value,local:(performance.now()+start)/2};
      setData(value);setError('');
      if(value.isHost&&value.party.playing)await community(path+'/presence',{method:'POST'});
      return value.ticket;
    }catch(e){clock.current=null;setData(null);setError(e.message);}
  }
  useUpdates('party:'+id,'party',refresh,Boolean(user));
  useMedia(media,data?.url);
  function sync(){
    const c=clock.current,v=media.current;if(!c||!v||v.readyState<1)return;
    const target=c.party.position+(c.party.playing?Math.max(0,c.serverTime-c.party.changed+performance.now()-c.local)/1000:0);
    const drift=Math.min(v.duration||Infinity,target)-v.currentTime;
    if(Math.abs(drift)>1||(!c.party.playing&&Math.abs(drift)>.08))v.currentTime=Math.max(0,v.currentTime+drift);
    v.playbackRate=c.party.playing&&Math.abs(drift)>.3?(drift>0?1.05:.95):1;
    if(!c.party.playing)v.pause();
    else if(accepted.current&&v.paused&&!v.ended)v.play().catch(()=>{accepted.current=false;setJoined(false);});
  }
  useEffect(()=>{const timer=setInterval(sync,500);return()=>clearInterval(timer);},[]);
  async function command(playing,position){
    try{await community(path,{method:'PATCH',body:{playing,position,version:clock.current.party.version}});await refresh();sync();}
    catch(e){await refresh();setError(e.message);}
  }
  return <FeatureLayout title={data?.title||'Watch party'} error={error}>{data&&<section className={panel}>
    <video className="aspect-video w-full bg-black" playsInline ref={media} onLoadedMetadata={sync}/>
    <div className="mt-4 flex flex-wrap gap-2">
    <button className={action} onClick={async()=>{try{await navigator.clipboard.writeText(location.href);setCopied(true);}catch{setError('Copy the page address to invite a viewer.');}}}>{copied?'Link copied':'Copy invite link'}</button>
    {!joined&&<button className={primary} onClick={()=>{accepted.current=true;setJoined(true);const v=media.current;v.play().then(sync).catch(()=>{accepted.current=false;setJoined(false);});}}>Join playback</button>}
    {data.isHost&&<><button className={action} onClick={()=>command(!data.party.playing,media.current.currentTime)}>{data.party.playing?'Pause everyone':'Play together'}</button>
    <form onSubmit={e=>{e.preventDefault();command(data.party.playing,Number(new FormData(e.currentTarget).get('time')));}}><input className={field} name="time" type="number" min="0" required aria-label="Seek position in seconds" placeholder="Seconds"/><button className={action}>Seek</button></form></>}
    </div></section>}</FeatureLayout>;
}

export function LivePage(){
  const {id}=useParams();return <Broadcast key={id||'list'} id={id}/>;
}
function Broadcast({id}){
  const {user}=useAuth(),nav=useNavigate(),ref=useRef();
  const [data,setData]=useState(null),[error,setError]=useState(''),[key,setKey]=useState(null),[busy,setBusy]=useState(false);
  const path='/live'+(id?'/'+id:'');
  async function refresh(){try{const value=await community(path);setData(value);return value.ticket;}catch(e){setError(e.message);}}
  useUpdates(id?'live:'+id:null,'chat',refresh,Boolean(user),message=>setData(old=>{
    if(!old?.messages||old.messages.some(item=>item._id===message._id))return old;
    return {...old,messages:[...old.messages,message].slice(-80)};
  }));
  useMedia(ref,data?.status==='live'?data.url:null);
  async function run(work){setBusy(true);setError('');try{await work();}catch(e){setError(e.message);}finally{setBusy(false);}}
  return <FeatureLayout title={data?.title||'Live broadcasts'} error={error}>
    {!id&&<><form className={panel} onSubmit={e=>{e.preventDefault();const title=new FormData(e.currentTarget).get('title');run(async()=>nav('/live/'+(await community('/live',{method:'POST',body:{title}})).id));}}>
    <input className={field} name="title" required maxLength="160" placeholder="Broadcast title" aria-label="Broadcast title"/><button disabled={busy} className={primary}>Create public broadcast</button></form>
    {data?.items?.map(item=><Link className={'block '+panel} key={item._id} to={'/live/'+item._id}>{item.title} · {item.status}</Link>)}</>}
    {id&&data&&<><section className={panel}><p>Broadcast status · {data.status}</p>
    {data.status==='live'&&<video ref={ref} className="aspect-video w-full" playsInline controls/>}
    {data.replay&&<Link className={primary} to={'/watch/'+data.replay}>Watch recording</Link>}
    {data.isHost&&['waiting','live'].includes(data.status)&&<div className="mt-3 flex flex-wrap gap-2">
    <button className={action} disabled={busy} onClick={()=>run(async()=>setKey(key?null:await community(path+'/key')))}>{key?'Hide OBS settings':'Show OBS settings'}</button>
    <button className={action} disabled={busy} onClick={()=>run(async()=>{await community(path+'/end',{method:'POST'});setKey(null);await refresh();})}>End broadcast</button>
    {key&&<p className="w-full break-all">OBS server {key.server}<br/>Stream key {key.key}</p>}</div>}</section>
    <section className={panel}><h2>Live chat</h2><ul className="max-h-64 overflow-auto">{data.messages.map(m=><li key={m._id}><strong>{m.name}</strong> {m.body}</li>)}</ul>
    {data.status==='live'&&<form onSubmit={e=>{e.preventDefault();const form=e.currentTarget,body=new FormData(form).get('body');run(async()=>{await community(path+'/chat',{method:'POST',body:{body}});form.reset();await refresh();});}}>
    <input className={field} name="body" maxLength="500" required placeholder="Send a message" aria-label="Chat message"/><button disabled={busy} className={action}>Send</button></form>}</section></>}
  </FeatureLayout>;
}
