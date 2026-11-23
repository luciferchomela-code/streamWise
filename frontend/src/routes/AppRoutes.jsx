import {PartyPage,LivePage,Inbox} from "../pages/Features/Community";
import React, { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import Login from '../pages/Login/Login';
import Home from '../pages/Home/Home';
import Profile from '../pages/Profile/Profile';
import MyChannel from '../pages/Channel/MyChannel';
import WatchLater from '../pages/WatchLater/WatchLater';
import Subscriptions from '../pages/Subscriptions/Subscriptions';
import History from '../pages/History/History';
const DesignBoard = import.meta.env.DEV ? lazy(() => import('../pages/Home/DesignBoard')) : null;
const WatchVideo = lazy(() => import('../pages/Watch/WatchVideo'));
const UploadVideo = lazy(() => import('../pages/Upload/UploadVideo'));

const CreatorStudio = lazy(() => import('../pages/Features/CreatorStudio'));
const Playlists = lazy(() => import('../pages/Features/Playlists'));
const Moderation = lazy(() => import('../pages/Features/Moderation'));
const PlaybackHealth = lazy(() => import('../pages/Features/PlaybackHealth'));

export const AppRoutes = () => {
  return (
    <Suspense fallback={<p role="status">Loading page…</p>}>
    <Routes>
      <Route path="/party/:id" element={<PartyPage/>}/><Route path="/live" element={<LivePage/>}/><Route path="/live/:id" element={<LivePage/>}/><Route path="/notifications" element={<Inbox/>}/>
      <Route path="/" element={<Home />} />
      {DesignBoard && <Route path="/design-board" element={<DesignBoard />} />}
      <Route path="/login" element={<Login />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/channel" element={<MyChannel />} />
      <Route path="/channel/:channelId" element={<MyChannel />} />
      <Route path="/watch/:videoId" element={<WatchVideo />} />
      <Route path="/watch-later" element={<WatchLater />} />
      <Route path="/saved" element={<WatchLater />} />
      <Route path="/subscriptions" element={<Subscriptions />} />
      <Route path="/following" element={<Subscriptions />} />
      <Route path="/studio" element={<CreatorStudio />} />
      <Route path="/playlists" element={<Playlists />} />
      <Route path="/playlists/:playlistId" element={<Playlists />} />
      <Route path="/moderation" element={<Moderation />} />
      <Route path="/ops/playback-health" element={<PlaybackHealth />} />
      <Route path="/upload" element={<UploadVideo />} />
      <Route path="/history" element={<History />} />
      <Route path="*" element={<Login />} />
    </Routes>
    </Suspense>
  );
};

