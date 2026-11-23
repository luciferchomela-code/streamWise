import {lazy,Suspense} from 'react';
import {Route,Routes,Link} from 'react-router-dom';
import Navigation from './Navigation';
import Catalog from './Catalog';
import Account from './Account';
import {PartyPage,LivePage,Inbox} from '../pages/Features/Community';
import './screen.css';
import './interactions.css';

const screens={
 '/watch/:videoId':lazy(()=>import('../pages/Watch/WatchVideo')),
 '/channel':lazy(()=>import('./Channel')),
 '/channel/:channelId':lazy(()=>import('./Channel')),
 '/upload':lazy(()=>import('../pages/Upload/UploadVideo')),
 '/studio':lazy(()=>import('../pages/Features/CreatorStudio')),
 '/moderation':lazy(()=>import('../pages/Features/Moderation')),
 '/ops/playback-health':lazy(()=>import('../pages/Features/PlaybackHealth')),
 '/playlists':lazy(()=>import('../pages/Features/Playlists')),
 '/playlists/:playlistId':lazy(()=>import('../pages/Features/Playlists')),
 '/party/:id':PartyPage,'/live':LivePage,'/live/:id':LivePage,'/notifications':Inbox,'/login':Account,'/profile':Account
};
export default function ScreeningRoom(){
 return <><Navigation/><div className="content"><Suspense fallback={<p role="status">Loading…</p>}><Routes>
 <Route path="/" element={<Catalog/>}/>
 {Object.entries({'/subscriptions':'following','/following':'following','/history':'history','/watch-later':'saved','/saved':'saved'}).map(([path,source])=><Route key={path} path={path} element={<Catalog source={source}/>}/>)}
 {Object.entries(screens).map(([path,Screen])=><Route key={path} path={path} element={<Screen/>}/>)}
 <Route path="*" element={<main className="folio"><h1>Page unavailable</h1><Link to="/">Browse videos</Link></main>}/>
 </Routes></Suspense></div></>
}


