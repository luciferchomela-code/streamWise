import {useEffect,useState} from 'react';
import {Link,useParams} from 'react-router-dom';
import {useAuth} from '../hooks/useAuth';
import {channelService as channels} from '../services/channelService';
import {videoService} from '../services/videoService';
import ImageUploader from '../components/common/ImageUploader/ImageUploader';
import {VideoTile} from './Catalog';

export default function Channel(){
 const {channelId}=useParams(),{user,loading}=useAuth();
 const [channel,setChannel]=useState(),[videos,setVideos]=useState([]),[error,setError]=useState(''),[edit,setEdit]=useState(false),[busy,setBusy]=useState(false),[image,setImage]=useState('');
 useEffect(()=>{
   let active=true;
   setChannel(undefined);setVideos([]);setError('');setEdit(false);
   if(loading||(!channelId&&!user))return;
   async function load(){
     const response=await (channelId?channels.getChannel(channelId):channels.getMyChannel());
     if(!active)return;
     const ch=response?.channel||null;
     setChannel(ch);setImage(ch?.image||'');
     if(ch){const r=await videoService.getChannelVideos(ch._id);if(active)setVideos(r.videos);}
   }
   load().catch(e=>{if(active)setError(e.message)});
   return ()=>{active=false};
 },[channelId,user,loading]);
 async function save(e){
   e.preventDefault();const fields=Object.fromEntries(new FormData(e.currentTarget));setBusy(true);setError('');
   try{const data=await (channel?channels.updateChannel({...fields,image}):channels.createChannel({...fields,image}));setChannel(data.channel);setEdit(false)}
   catch(e){setError(e.message)}finally{setBusy(false)}
 }
 if(!loading&&!channelId&&!user)return <main className="folio"><Link to="/login">Sign in to manage your channel</Link></main>;
 return <main className="desk"><header><h1>{channel?.name||'Channel'}</h1>{channel&&!channelId&&<button onClick={()=>setEdit(!edit)}>{edit?'Cancel':'Edit channel'}</button>}</header>
 {error&&<p role="alert">{error}</p>}{channel===undefined&&!error&&<p role="status">Loading channel…</p>}
 {(edit||channel===null&&!channelId)?<form className="submission" onSubmit={save}><fieldset disabled={busy}>{['name','handle','category','description'].map(key=><label key={key}>{key}<input name={key} required={key!=='description'} defaultValue={channel?.[key]||(key==='category'?'General':'')}/></label>)}<button className="ticket">{channel?'Save changes':'Create channel'}</button></fieldset><ImageUploader imageType="avatar" label="Channel picture" aspectRatio="1 / 1" onUploadComplete={setImage}/></form>:channel&&<>
 <p>{channel.description}</p><span>{channel.subscribersCount||0} subscribers</span><h2>Channel videos</h2><div className="films">{videos.map(v=><VideoTile key={v.id} video={v}/>)}</div></>}</main>;
}
