import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Login from '../pages/Login/Login';
import Home from '../pages/Home/Home';
import Profile from '../pages/Profile/Profile';
import MyChannel from '../pages/Channel/MyChannel';
import WatchVideo from '../pages/Watch/WatchVideo';
import WatchLater from '../pages/WatchLater/WatchLater';
import Subscriptions from '../pages/Subscriptions/Subscriptions';
import History from '../pages/History/History';
import UploadVideo from '../pages/Upload/UploadVideo';

export const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/channel" element={<MyChannel />} />
      <Route path="/channel/:channelId" element={<MyChannel />} />
      <Route path="/watch/:videoId" element={<WatchVideo />} />
      <Route path="/watch-later" element={<WatchLater />} />
      <Route path="/saved" element={<WatchLater />} />
      <Route path="/subscriptions" element={<Subscriptions />} />
      <Route path="/following" element={<Subscriptions />} />
      <Route path="/upload" element={<UploadVideo />} />
      <Route path="/history" element={<History />} />
      <Route path="*" element={<Login />} />
    </Routes>
  );
};

