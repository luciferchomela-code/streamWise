import React, { useRef, useState, useEffect, useCallback } from 'react';
import { featureRequest } from '../../../services/featuresService';
import { interactionService } from '../../../services/interactionService';
import { createPlaybackSession } from '../../../services/playbackTelemetry';

const formatTime = (seconds) => {
  if (isNaN(seconds)) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export const VideoPlayer = ({
  videoId,
  title,
  thumbnailUrl,
  hlsUrl,
  mp4Url,
  duration,
  startPosition = 0,
  trackHistory = false,
  storyboard = [],
}) => {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const hlsRef = useRef(null);
  const telemetryRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [durationTime, setDurationTime] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [error, setError] = useState(null);

  // Quality controls
  const [levels, setLevels] = useState([]);
  const [currentLevel, setCurrentLevel] = useState(-1);

  const [captions, setCaptions] = useState([]);
  const [captionLanguage, setCaptionLanguage] = useState('');
  const [captionUrl, setCaptionUrl] = useState('');
  const [captionError, setCaptionError] = useState('');
  const captionTrackRef = useRef(null);
  useEffect(() => {
    if (!videoId) return;
    const controller = new AbortController();
    featureRequest(`/captions/${videoId}`, { signal: controller.signal })
      .then((result) => setCaptions(result.captions)).catch(() => {});
    return () => controller.abort();
  }, [videoId, trackHistory]);
  useEffect(() => {
    setCaptionUrl('');
    setCaptionError('');
    if (!videoId || !captionLanguage) return;
    const controller = new AbortController();
    let url;
    featureRequest(`/captions/${videoId}/${captionLanguage}`, { signal: controller.signal, text: true })
      .then((text) => {
        if (controller.signal.aborted) return;
        url = URL.createObjectURL(new Blob([text], { type: 'text/vtt' }));
        setCaptionUrl(url);
      }).catch(() => { if (!controller.signal.aborted) setCaptionError('Captions could not load.'); });
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [videoId, captionLanguage]);
  useEffect(() => {
    const track = captionTrackRef.current?.track;
    if (track) track.mode = 'showing';
  }, [captionUrl]);

  const [openMenu, setOpenMenu] = useState(null);
  const [playbackAttempt, setPlaybackAttempt] = useState(0);
  const [previewTime, setPreviewTime] = useState(null);
  const preview = previewTime === null ? null : storyboard.findLast((frame) => frame.time <= previewTime);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let disposed = false;
    let hls;
    const streamUrl = hlsUrl || mp4Url;
    const isHls = Boolean(hlsUrl || streamUrl?.includes('.m3u8'));
    const telemetry = createPlaybackSession(videoId, isHls ? 'hls' : 'mp4');
    telemetryRef.current = telemetry;

    const clearEngine = () => {
      if (!hls) return;
      hls.destroy();
      hlsRef.current = null;
      hls = null;
    };
    const fallback = (code = 'stream_unavailable') => {
      const resume = !video.paused;
      clearEngine();
      setLevels([]);
      setCurrentLevel(-1);
      if (mp4Url) {
        if (isHls) telemetry?.fallback(code);
        telemetry?.source('mp4', 'native');
        video.src = mp4Url;
        if (resume) void video.play().catch(() => {});
      }
      else {
        telemetry?.error(code);
        setIsBuffering(false);
        setError('Failed to load video stream.');
      }
    };

    setOpenMenu(null);
    setLevels([]);
    setCurrentLevel(-1);
    if (isHls) {
      void import('hls.js/light').then(({ default: Hls }) => {
        if (disposed) return;
        if (!Hls.isSupported()) {
          if (video.canPlayType('application/vnd.apple.mpegurl')) video.src = streamUrl;
          else fallback();
          return;
        }
        hls = new Hls({ maxMaxBufferLength: 30 });
        telemetry?.source('hls', 'hls.js');
        hlsRef.current = hls;
        let attemptedMediaRecovery = false;
        hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
          setIsBuffering(false);
          setLevels(data.levels || []);
        });
        hls.on(Hls.Events.FRAG_LOADED, (_, { frag }) => {
          if (frag.type === 'main') telemetry?.delivery(frag.stats);
        });
        hls.on(Hls.Events.ERROR, (_, data) => {
          if (!data.fatal || !hls) return;
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR && !attemptedMediaRecovery) {
            attemptedMediaRecovery = true;
            hls.recoverMediaError();
          } else {
            fallback(data.details);
          }
        });
        hls.loadSource(streamUrl);
        hls.attachMedia(video);
      }).catch(() => { if (!disposed) fallback(); });
    } else {
      fallback();
    }
    return () => {
      disposed = true;
      telemetryRef.current = null;
      clearEngine();
    };
  }, [videoId, hlsUrl, mp4Url, playbackAttempt]);

  // Video Events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateTime = () => setCurrentTime(video.currentTime);
    const updateDuration = () => {
      setDurationTime(video.duration);
      if (startPosition > 0 && video.currentTime === 0) {
        video.currentTime = startPosition;
      }
    };
    const updateProgress = () => {
      if (video.buffered.length > 0) {
        setBuffered(video.buffered.end(video.buffered.length - 1));
      }
    };
    const handlePlay = () => { setIsPlaying(true); setIsBuffering(false); telemetryRef.current?.attempt(); };
    const clearStall = () => telemetryRef.current?.clearStall();
    const handlePause = () => { setIsPlaying(false); clearStall(); };
    const handleWaiting = () => { setIsBuffering(true); telemetryRef.current?.waiting(video); };
    const handlePlaying = () => { setIsBuffering(false); telemetryRef.current?.playing(); };
    const handleError = () => {
      if (hlsRef.current) return;
      telemetryRef.current?.error(`media_${video.error?.code || 0}`);
      setError('An error occurred during playback.');
    };

    video.addEventListener('timeupdate', updateTime);
    video.addEventListener('loadedmetadata', updateDuration);
    video.addEventListener('progress', updateProgress);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('error', handleError);
    video.addEventListener('seeking', clearStall);

    return () => {
      video.removeEventListener('timeupdate', updateTime);
      video.removeEventListener('loadedmetadata', updateDuration);
      video.removeEventListener('progress', updateProgress);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('error', handleError);
      video.removeEventListener('seeking', clearStall);
    };
  }, [startPosition]);

  useEffect(() => {
    const video = videoRef.current;
    if (video?.readyState >= 1 && video.currentTime === 0 && startPosition > 0) {
      video.currentTime = Math.min(startPosition, video.duration);
    }
  }, [startPosition]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoId) return;
    let lastPosition = -1;
    let lastPlayed = 0;
    const saveProgress = () => {
      if (!Number.isFinite(video.duration) || video.duration <= 0) return;
      let played = 0;
      for (let i = 0; i < video.played.length; i++) {
        played += video.played.end(i) - video.played.start(i);
      }
      if (played < Math.min(5, video.duration * 0.5)) return;
      if (!trackHistory && lastPosition >= 0) return;
      if (lastPosition === video.currentTime && lastPlayed === played) return;
      lastPosition = video.currentTime;
      lastPlayed = played;
      interactionService.incrementView(videoId, Math.min(100, played / video.duration * 100), lastPosition)
        .catch(() => {});
    };
    const interval = setInterval(saveProgress, 15000);
    video.addEventListener('pause', saveProgress);
    video.addEventListener('ended', saveProgress);
    return () => {
      clearInterval(interval);
      video.removeEventListener('pause', saveProgress);
      video.removeEventListener('ended', saveProgress);
      saveProgress();
    };
  }, [videoId, trackHistory, playbackAttempt]);

  // Controls Auto-hide
  useEffect(() => {
    let timeout;
    const resetTimer = () => {
      setShowControls(true);
      clearTimeout(timeout);
      if (isPlaying) {
        timeout = setTimeout(() => setShowControls(false), 3000);
      }
    };
    const hideControls = () => { if (isPlaying) setShowControls(false); };
    const el = containerRef.current;
    if (el) {
      el.addEventListener('mousemove', resetTimer);
      el.addEventListener('mouseleave', hideControls);
    }
    resetTimer();
    return () => {
      if (el) {
        el.removeEventListener('mousemove', resetTimer);
        el.removeEventListener('mouseleave', hideControls);
      }
      clearTimeout(timeout);
    };
  }, [isPlaying]);

  // Actions
  const togglePlay = useCallback(() => {
    if (videoRef.current.paused) {
      telemetryRef.current?.intent();
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
    }
  }, []);

  const toggleMute = () => {
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
    if (volume === 0 && isMuted) {
      videoRef.current.volume = 1;
      setVolume(1);
    }
  };

  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    videoRef.current.volume = val;
    setIsMuted(val === 0);
    videoRef.current.muted = val === 0;
  };

  const handleSeek = (e) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    videoRef.current.currentTime = time;
  };

  useEffect(() => {
    const updateFullscreen = () => setIsFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener('fullscreenchange', updateFullscreen);
    return () => document.removeEventListener('fullscreenchange', updateFullscreen);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await containerRef.current?.requestFullscreen?.();
    } catch {}
  };

  const selectQuality = (level) => {
    if (!hlsRef.current) return;
    hlsRef.current.nextLevel = level;
    setCurrentLevel(level);
    setOpenMenu(null);
  };

  const togglePiP = async () => {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture().catch(() => {});
    } else if (document.pictureInPictureEnabled) {
      await videoRef.current.requestPictureInPicture().catch(() => {});
    }
  };

  const onPlayerKey = (event) => {
    if (event.target !== containerRef.current && event.target !== videoRef.current) return;
    const video = videoRef.current;
    if (!video) return;
    switch (event.key.toLowerCase()) {
      case ' ':
      case 'k':
        togglePlay();
        break;
      case 'f':
        void toggleFullscreen();
        break;
      case 'm':
        toggleMute();
        break;
      case 'arrowright':
      case 'l':
        video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 5);
        break;
      case 'arrowleft':
      case 'j':
        video.currentTime = Math.max(0, video.currentTime - 5);
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      role="region"
      aria-label={`Video player for ${title || 'this video'}`}
      aria-keyshortcuts="Space K M F ArrowLeft ArrowRight J L"
      onKeyDown={onPlayerKey}
      onFocus={() => setShowControls(true)}
      className="relative w-full focus-visible:ring-2 focus-visible:ring-cyan-400 aspect-video bg-[#0B0D12] rounded-2xl overflow-hidden shadow-2xl group flex justify-center items-center select-none"
      onDoubleClick={toggleFullscreen}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        poster={thumbnailUrl}
        preload="metadata"
        playsInline
        className="w-full h-full object-contain"
        onClick={togglePlay}
      >
        {captionUrl && <track key={captionUrl} ref={captionTrackRef} kind="captions" src={captionUrl}
          srcLang={captionLanguage} label={captions.find((track) => track.language === captionLanguage)?.label || captionLanguage} />}
      </video>

      {/* Buffering Spinner */}
      {isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="w-16 h-16 border-4 border-white/20 border-t-cyan-400 rounded-full animate-spin" />
        </div>
      )}

      {/* Error Overlay */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-20 gap-3">
          <svg className="w-12 h-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-white text-sm font-medium">{error}</p>
          <button type="button" className="rounded bg-white/15 px-4 py-2 text-white"
            onClick={() => { setError(null); setPlaybackAttempt(attempt => attempt + 1); }}>
            Retry playback
          </button>
        </div>
      )}

      {/* Play Button Overlay (when paused) */}
      {!isPlaying && !isBuffering && !error && (
        <button
          aria-label="Play video"
          onClick={togglePlay}
          className={`absolute inset-0 flex items-center justify-center bg-black/30 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'} hover:bg-black/40 group/play`}
        >
          <div className="w-20 h-20 bg-violet-600/80 backdrop-blur-md rounded-full flex items-center justify-center transform group-hover/play:scale-110 transition-transform shadow-[0_0_30px_rgba(139,92,246,0.5)]">
            <svg className="w-10 h-10 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </button>
      )}

      {/* Controls Overlay */}
      <div
        className={`absolute focus-within:opacity-100 focus-within:pointer-events-auto bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent px-4 pb-3 pt-12 transition-opacity duration-300 z-10 flex flex-col ${
          showControls && !error ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={(e) => e.stopPropagation()} // Prevent playing video when clicking controls
      >
        {/* Seek Bar */}
        <div className="relative w-full h-1.5 bg-white/20 rounded-full mb-3 cursor-pointer group/seek flex items-center"
          onPointerMove={(event) => {
            if (!storyboard.length || event.pointerType === 'touch' || !durationTime) return;
            const { width, left } = event.currentTarget.getBoundingClientRect();
            setPreviewTime(Math.min(1, Math.max(0, (event.clientX - left) / width)) * durationTime);
          }}
          onPointerLeave={() => setPreviewTime(null)}>
          {preview && <div className="pointer-events-none absolute bottom-4 z-10 w-24 -translate-x-1/2 overflow-hidden rounded bg-black text-center text-xs text-white sm:w-36"
            style={{ left: `clamp(48px, ${100 * previewTime / durationTime}%, calc(100% - 48px))` }} aria-hidden="true">
            <img src={preview.url} alt="" className="aspect-video w-full object-cover" />
            <span>{formatTime(previewTime)}</span>
          </div>}
          {/* Buffered Progress */}
          <div
            className="absolute top-0 left-0 h-full bg-white/40 rounded-full pointer-events-none"
            style={{ width: `${(buffered / (durationTime || 1)) * 100}%` }}
          />
          {/* Played Progress */}
          <div
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-violet-500 to-cyan-400 rounded-full pointer-events-none"
            style={{ width: `${(currentTime / (durationTime || 1)) * 100}%` }}
          />
          {/* Seek Input */}
          <input
            type="range"
            aria-label="Playback position"
            min="0"
            max={durationTime || 100}
            value={currentTime}
            onChange={handleSeek}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
          />
          {/* Hover Scrubber thumb */}
          <div
            className="absolute w-3 h-3 bg-cyan-400 rounded-full -ml-1.5 shadow-[0_0_10px_#22D3EE] opacity-0 group-hover/seek:opacity-100 group-focus-within/seek:opacity-100 transition-opacity pointer-events-none z-10"
            style={{ left: `${(currentTime / (durationTime || 1)) * 100}%` }}
          />
        </div>

        {/* Lower Controls */}
        <div className="flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-2 sm:gap-4">
            {/* Play/Pause */}
            <button aria-label={isPlaying ? "Pause" : "Play"} onClick={togglePlay} className="text-white hover:text-cyan-400 transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400">
              {isPlaying ? (
                <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
              ) : (
                <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
              )}
            </button>

            {/* Volume */}
            <div className="flex items-center gap-2 group/vol relative">
              <button aria-label={isMuted ? "Unmute" : "Mute"} onClick={toggleMute} className="text-white hover:text-cyan-400 transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400">
                {isMuted || volume === 0 ? (
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
                ) : volume < 0.5 ? (
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M5 9v6h4l5 5V4L9 9H5zm11.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>
                ) : (
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
                )}
              </button>
              <input
                type="range"
                aria-label="Volume"
                min="0" max="1" step="0.01"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-0 opacity-0 group-hover/vol:w-20 group-hover/vol:opacity-100 group-focus-within/vol:w-20 group-focus-within/vol:opacity-100 transition-all duration-300 origin-left cursor-pointer accent-cyan-400"
              />
            </div>

            {/* Time */}
            <div className="text-white text-xs font-medium tracking-wide">
              {formatTime(currentTime)} <span className="text-gray-400 mx-1">/</span> {formatTime(durationTime)}
            </div>
          </div>

          <div className="flex min-w-0 items-center gap-2 sm:gap-4">
            {captions.length > 0 && <select aria-label="Captions"
              className="max-w-28 rounded bg-slate-900 px-1 py-1 text-xs text-white"
              value={captionLanguage} onChange={(event) => setCaptionLanguage(event.target.value)}>
              <option value="">Captions off</option>
              {captions.map((track) => <option value={track.language} key={track.language}>{track.label}</option>)}
            </select>}
            {captionError && <span role="status" className="text-xs text-red-200">{captionError}</span>}
            {/* Playback Speed */}
            <div className="relative group/speed">
              <button aria-label="Playback speed" aria-expanded={openMenu === 'speed'}
                onClick={() => setOpenMenu(openMenu === 'speed' ? null : 'speed')}
                className="text-white text-xs font-bold px-2 py-1 rounded hover:bg-white/10 focus-visible:ring-2">
                {playbackRate}x
              </button>
              <div hidden={openMenu !== 'speed'} className="absolute bottom-full right-0 mb-2 bg-[#151923] rounded-lg shadow-xl border border-white/5 overflow-hidden">
                {[0.5, 1, 1.25, 1.5, 2].map(rate => (
                  <button
                    key={rate}
                    aria-pressed={playbackRate === rate}
                    onClick={() => { setPlaybackRate(rate); videoRef.current.playbackRate = rate; setOpenMenu(null); }}
                    className={`px-4 py-2 text-xs text-left hover:bg-white/10 ${playbackRate === rate ? 'text-cyan-400 font-bold' : 'text-gray-300'}`}
                  >
                    {rate}x
                  </button>
                ))}
              </div>
            </div>

            {/* Quality Selector (if HLS levels exist) */}
            {levels.length > 0 && (
              <div className="relative group/quality">
                <button aria-label="Video quality" aria-expanded={openMenu === 'quality'}
                  onClick={() => setOpenMenu(openMenu === 'quality' ? null : 'quality')}
                  className="text-white text-xs font-bold px-2 py-1 rounded hover:bg-white/10 focus-visible:ring-2 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  {currentLevel === -1 ? 'Auto' : (levels[currentLevel]?.height ? `${levels[currentLevel].height}p` : 'Manual')}
                </button>
                <div hidden={openMenu !== 'quality'} className="absolute bottom-full right-0 mb-2 bg-[#151923] rounded-lg shadow-xl border border-white/5 overflow-hidden">
                  <button
                    onClick={() => selectQuality(-1)}
                    aria-pressed={currentLevel === -1}
                    className={`px-4 py-2 text-xs text-left hover:bg-white/10 whitespace-nowrap ${currentLevel === -1 ? 'text-cyan-400 font-bold' : 'text-gray-300'}`}
                  >
                    Auto
                  </button>
                  {[...levels].reverse().map((level, index) => {
                    const originalIndex = levels.length - 1 - index;
                    return (
                      <button
                        key={originalIndex}
                        onClick={() => selectQuality(originalIndex)}
                        aria-pressed={currentLevel === originalIndex}
                        className={`px-4 py-2 text-xs text-left hover:bg-white/10 whitespace-nowrap ${currentLevel === originalIndex ? 'text-cyan-400 font-bold' : 'text-gray-300'}`}
                      >
                        {level.height}p
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* PiP */}
            {document.pictureInPictureEnabled && (
              <button aria-label="Picture in picture" onClick={togglePiP} className="text-white hover:text-cyan-400 transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400" title="Picture in Picture">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11V9a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2h4m6 0v-4m0 0l-3 3m3-3l3 3" /></svg>
              </button>
            )}

            {/* Fullscreen */}
            <button aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"} onClick={toggleFullscreen} className="text-white hover:text-cyan-400 transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400">
              {isFullscreen ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
