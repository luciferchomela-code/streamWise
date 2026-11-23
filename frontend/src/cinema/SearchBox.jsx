import {useEffect, useRef, useState} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import {videoService} from '../services/videoService';

export default function SearchBox({initialQuery}) {
  const [text,setText]=useState(initialQuery);
  const [open,setOpen]=useState(false);
  const [matches,setMatches]=useState(null);
  const input=useRef(null);
  const navigate=useNavigate();
  const term=text.trim();
  useEffect(()=>{
    function shortcut(event){
      if ((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){
        event.preventDefault();
        input.current?.focus();
        input.current?.select();
      }
    }
    window.addEventListener('keydown',shortcut);
    return ()=>window.removeEventListener('keydown',shortcut);
  },[]);
  useEffect(()=>{
    if (!open||term.length<2) return;
    let active=true;
    const timer=setTimeout(async()=>{
      try {
        const {videos}=await videoService.search(term,{limit:4});
        if(active)setMatches({term,videos});
      } catch {if(active)setMatches({term,failed:true});}
    },300);
    return ()=>{active=false;clearTimeout(timer);};
  },[open,term]);
  function submit(event){
    event.preventDefault();
    if(!term){input.current.focus();return;}
    setOpen(false);
    navigate('/?q='+encodeURIComponent(term));
    input.current.blur();
  }
  const current=matches?.term===term?matches:null;
  return <form className="catalog-search" role="search" onSubmit={submit}
    onFocus={()=>setOpen(true)} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))setOpen(false)}}
    onKeyDown={e=>{if(e.key==='Escape'){input.current.focus();setOpen(false)}}}>
    <button className="search-submit" aria-label="Search videos" type="submit"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/></svg></button>
    <input ref={input} aria-label="Search the video library" type="search" value={text} onChange={e=>{setText(e.target.value);setOpen(true)}} autoComplete="off" placeholder="Search the video library"/>
    {text?<button type="button" aria-label="Clear search" onClick={()=>{setText('');input.current.focus()}}>×</button>:<kbd>{/Mac/i.test(navigator.platform)?'⌘ K':'Ctrl K'}</kbd>}
    {open&&term.length>=2&&<div className="search-preview">
      {!current?<p role="status">Searching…</p>:current.failed?<p role="status">Suggestions unavailable</p>:current.videos.length===0?<p role="status">No matching videos</p>:current.videos.map(v=><Link key={v.id} to={'/watch/'+v.id} onClick={()=>setOpen(false)}>
        {v.thumbnail&&<img alt="" src={v.thumbnail}/>}<span><strong>{v.title}</strong><small>{v.creator}</small></span></Link>)}
      <button type="submit" className="all-results">Search for “{term}” <span aria-hidden="true">↵</span></button>
    </div>}
  </form>;
}
