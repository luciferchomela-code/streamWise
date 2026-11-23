import { useEffect, useState, useRef } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { normalizeVideo, videoService } from '../services/videoService';
import { interactionService } from '../services/interactionService';
import { channelService } from '../services/channelService';
import { useAuth } from '../hooks/useAuth';

export function VideoTile({video, index, feedId}) {
  const ref = useRef(null);
  useEffect(() => {
    if (!feedId) return;
    const observer = new IntersectionObserver(([entry]) => {
      if(entry.intersectionRatio >= .5) {
        observer.disconnect();
        videoService.recordImpression(feedId,index).catch(()=>{});
      }
    }, {threshold:.5});
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [feedId,index]);
  return <Link ref={ref} className="film" to={'/watch/'+video.id+(feedId ? '?'+new URLSearchParams({feedId,pos:index}) : '')}>
    <div className="frame">{video.thumbnail && <img loading="lazy" src={video.thumbnail} alt=""/>}{video.duration && <small>{video.duration}</small>}</div>
    <strong>{video.title}</strong><span>{video.creator} · {video.views} views</span>
  </Link>;
}

const sources = {
  trending: (_,page) => videoService.getTrending({page,limit:12}),
  discover: () => videoService.getTrending({limit:12}),
  popular: (_,page) => videoService.getPopular({page,limit:12}),
  feed: () => videoService.getFeed(),
  search: (query,page) => videoService.search(query,{page,limit:12}),
  saved: async (_,page) => { const r=await interactionService.getWatchLater(page); return {...r,videos:r.videos.map(normalizeVideo)}; },
  history: async (_,page) => { const r=await interactionService.getHistory(page); return {...r,videos:r.history.map(normalizeVideo)}; },
  following: async (_,page) => { const [v,c]=await Promise.all([channelService.getSubscribedVideos(page),channelService.getMySubscriptions()]); return {...v,videos:v.videos.map(normalizeVideo),channels:c.channels}; },
  resume: async () => ({videos:(await interactionService.getContinueWatching()).continueWatching.map(normalizeVideo)})
};
const names={discover:'Now showing',trending:'Trending',popular:'Most viewed',feed:'For you',saved:'Watch later',history:'Viewing history',following:'Subscriptions',resume:'Continue watching'};
function Spotlight({ videos }) {
  const [index, setIndex] = useState(0);
  const video = videos[index % videos.length];
  const path = '/watch/' + video.id;
  function step(direction) {
    setIndex(current => (current + direction + videos.length) % videos.length);
  }
  return <article className="spotlight" aria-label="Featured videos">
    <Link className="poster" to={path} aria-label={'Watch ' + video.title}>
      {video.thumbnail && <img src={video.thumbnail} alt="" fetchPriority="high"/>}
    </Link>
    <div className="spotlight-copy">
      <div aria-live="polite" aria-atomic="true">
        <small>{[video.creator, video.duration].filter(Boolean).join(' · ')}</small>
        <h1>{video.title}</h1>
        {video.description && <p>{video.description}</p>}
      </div>
      <div className="spotlight-actions">
        <Link className="ticket" to={path}>Watch video</Link>
        {videos.length > 1 && <div className="reel-controls">
          <button aria-label="Previous featured video" onClick={()=>step(-1)}>&larr;</button>
          <span>{index + 1} / {videos.length}</span>
          <button aria-label="Next featured video" onClick={()=>step(1)}>&rarr;</button>
        </div>}
      </div>
    </div>
  </article>;
}
function Collection({source,query='',lead=false}) {
  const [result,setResult]=useState(null),[error,setError]=useState(''),[page,setPage]=useState(1),[attempt,retry]=useState(0);
  useEffect(()=>{
    let active=true;
    setResult(null); setError('');
    sources[source](query,page).then(r=>{if(active)setResult(r)}).catch(e=>{if(active)setError(e.message)});
    return ()=>{active=false};
  },[source,query,page,attempt]);
  const videos=result?.videos||[], featured=lead ? videos.slice(0,3) : [];
  const title = source === 'search' ? 'Results for “'+query+'”' : names[source];
  const status = error ? <div role="alert" className="catalog-status"><p>Couldn’t load {title.toLowerCase()}.</p><button onClick={()=>retry(attempt+1)}>Try again</button></div>
    : !result ? <p role="status" className="catalog-status">Loading videos…</p>
    : !videos.length ? <p className="catalog-status">No videos here yet.</p> : null;
  return <section className={'collection'+(lead?' lead-collection':'')}>
    {lead && status ? <div className="cover-state"><div><h1>{title}</h1>{status}</div></div>
      : <><h2>{title}</h2>{status}</>}
    {result && <>
    {result.channels?.length>0 && <nav className="rail">{result.channels.map(c=><Link key={c._id} to={'/channel/'+c._id}>{c.name}</Link>)}</nav>}
    {featured.length > 0 && <Spotlight videos={featured}/>}
    {source === 'popular' ? <ol className="chart-list">{videos.map((video,index)=>
      <li key={video.id}><span className="chart-position" aria-hidden="true">{String(index+1).padStart(2,'0')}</span>
        <VideoTile video={video}/></li>)}</ol> :
      <div className="films">{videos.slice(featured.length).map((video,index)=><VideoTile key={video.id} {...{video,index,feedId:result.feedId}}/>)}</div>}

    {result.totalPages>1 && <nav className="rail"><button disabled={page===1} onClick={()=>setPage(page-1)}>Previous</button><span>{page} / {result.totalPages}</span><button disabled={page>=result.totalPages} onClick={()=>setPage(page+1)}>Next</button></nav>}
    </>}</section>
}
export default function Catalog({source}) {
  const [params]=useSearchParams(),query=params.get('q')?.trim(),{user,loading}=useAuth();
  const {hash}=useLocation();
  const lane=source || (hash ? hash.slice(1) : params.get('browse')) || 'discover';
  const tabs=[['discover','Discover','/#discover'],['trending','Trending','/#trending'],['popular','Most viewed','/#popular'],['following','Subscriptions','/subscriptions']];
  const locked=source && !user;
  const showTabs=!query && (!source || source==='following');
  return <main className="folio" key={user?._id||user?.id||'guest'}>
    {showTabs&&<nav className="browse-tabs" aria-label="Discovery feeds">{tabs.map(([key,label,url])=>
      <Link key={key} aria-current={lane===key?'page':undefined} to={url}>{label}</Link>
    )}</nav>}
    {locked ? <p className="catalog-status">{loading?'Loading account…':<Link to="/login">Sign in to open your library</Link>}</p>
      :source?<Collection key={source} source={source}/>
      :query?<Collection key={query} source="search" query={query}/>
      :['feed','popular','trending'].includes(lane)?<Collection key={lane} source={lane}/>
      :<><Collection source="discover" lead/><Collection source="feed"/>{user&&<Collection source="resume"/>}<Collection source="popular"/></>}
  </main>;
}
