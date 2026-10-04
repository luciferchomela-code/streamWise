import React, { useRef, useState, useEffect, useCallback } from 'react';
import Hls from 'hls.js';
import { interactionService } from '../../../services/interactionService';

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
}) => {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const hlsRef = useRef(null);
  const progressIntervalRef = useRef(null);

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

  const [milestonesTracked, setMilestonesTracked] = useState(new Set());

  // Initialization & HLS attachment
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const streamUrl = hlsUrl || mp4Url;
    if (!streamUrl) {
      setError('Video is unavailable');
      return;
    }

    if (Hls.isSupported() && streamUrl.includes('m3u8')) {
      const hls = new Hls({
        maxMaxBufferLength: 30, // Adaptive buffering
      });
      hlsRef.current = hls;

      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
        setIsBuffering(false);
        setLevels(data.levels || []);
        setCurrentLevel(hls.currentLevel);
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
        setCurrentLevel(data.level);
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              if (mp4Url) {
                // Fallback to MP4
                video.src = mp4Url;
              } else {
                setError('Failed to load video stream');
              }
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari Native HLS
      video.src = streamUrl;
    } else if (mp4Url) {
      video.src = mp4Url;
    } else {
      setError('Your browser does not support this video format.');
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
    };
  }, [hlsUrl, mp4Url]);

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
    const handlePlay = () => { setIsPlaying(true); setIsBuffering(false); };
    const handlePause = () => setIsPlaying(false);
    const handleWaiting = () => setIsBuffering(true);
    const handlePlaying = () => setIsBuffering(false);
    const handleError = () => setError('An error occurred during playback.');

    video.addEventListener('timeupdate', updateTime);
    video.addEventListener('loadedmetadata', updateDuration);
    video.addEventListener('progress', updateProgress);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('error', handleError);

    return () => {
      video.removeEventListener('timeupdate', updateTime);
      video.removeEventListener('loadedmetadata', updateDuration);
      video.removeEventListener('progress', updateProgress);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('error', handleError);
    };
  }, []);

  // Milestone Tracking (Backend Analytics)
  useEffect(() => {
    if (!videoId || !durationTime) return;

    const trackMilestone = async (percentage) => {
      if (milestonesTracked.has(percentage)) return;
      try {
        await interactionService.incrementView(videoId, percentage, currentTime);
        setMilestonesTracked((prev) => new Set(prev).add(percentage));
      } catch (e) {
        // Silent failure for analytics
      }
    };

    const pct = (currentTime / durationTime) * 100;
    if (pct > 1 && !milestonesTracked.has(1)) trackMilestone(1); // Start
    if (pct >= 25 && !milestonesTracked.has(25)) trackMilestone(25);
    if (pct >= 50 && !milestonesTracked.has(50)) trackMilestone(50);
    if (pct >= 75 && !milestonesTracked.has(75)) trackMilestone(75);
    if (pct >= 90 && !milestonesTracked.has(90)) trackMilestone(90);
    if (pct >= 99 && !milestonesTracked.has(100)) trackMilestone(100);
  }, [currentTime, durationTime, videoId, milestonesTracked]);

  // Periodic Watch Progress Save (every 10s)
  useEffect(() => {
    if (!isPlaying || !videoId || durationTime === 0) return;
    const interval = setInterval(() => {
      const pct = (currentTime / durationTime) * 100;
      interactionService.incrementView(videoId, pct, currentTime).catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
  }, [isPlaying, currentTime, durationTime, videoId]);

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
    const el = containerRef.current;
    if (el) {
      el.addEventListener('mousemove', resetTimer);
      el.addEventListener('mouseleave', () => { if (isPlaying) setShowControls(false); });
    }
    resetTimer();
    return () => {
      if (el) {
        el.removeEventListener('mousemove', resetTimer);
        el.removeEventListener('mouseleave', () => {});
      }
      clearTimeout(timeout);
    };
  }, [isPlaying]);

  // Actions
  const togglePlay = useCallback(() => {
    if (videoRef.current.paused) {
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

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const togglePiP = async () => {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture().catch(() => {});
    } else if (document.pictureInPictureEnabled) {
      await videoRef.current.requestPictureInPicture().catch(() => {});
    }
  };

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!containerRef.current?.contains(document.activeElement) && document.activeElement.tagName !== 'BODY') {
        return; // User is typing somewhere else
      }
      
      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'arrowright':
        case 'l':
          e.preventDefault();
          videoRef.current.currentTime += 5;
          break;
        case 'arrowleft':
        case 'j':
          e.preventDefault();
          videoRef.current.currentTime -= 5;
          break;
        default:
          break;
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay]);

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video bg-[#0B0D12] rounded-2xl overflow-hidden shadow-2xl group flex justify-center items-center select-none"
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
      />

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
        </div>
      )}

      {/* Play Button Overlay (when paused) */}
      {!isPlaying && !isBuffering && !error && (
        <button
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
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent px-4 pb-3 pt-12 transition-opacity duration-300 z-10 flex flex-col ${
          showControls && !error ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={(e) => e.stopPropagation()} // Prevent playing video when clicking controls
      >
        {/* Seek Bar */}
        <div className="relative w-full h-1.5 bg-white/20 rounded-full mb-3 cursor-pointer group/seek flex items-center">
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
            min="0"
            max={durationTime || 100}
            value={currentTime}
            onChange={handleSeek}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
          />
          {/* Hover Scrubber thumb */}
          <div
            className="absolute w-3 h-3 bg-cyan-400 rounded-full -ml-1.5 shadow-[0_0_10px_#22D3EE] opacity-0 group-hover/seek:opacity-100 transition-opacity pointer-events-none z-10"
            style={{ left: `${(currentTime / (durationTime || 1)) * 100}%` }}
          />
        </div>

        {/* Lower Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Play/Pause */}
            <button onClick={togglePlay} className="text-white hover:text-cyan-400 transition-colors focus:outline-none">
              {isPlaying ? (
                <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
              ) : (
                <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
              )}
            </button>

            {/* Volume */}
            <div className="flex items-center gap-2 group/vol relative">
              <button onClick={toggleMute} className="text-white hover:text-cyan-400 transition-colors focus:outline-none">
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
                min="0" max="1" step="0.01"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-0 opacity-0 group-hover/vol:w-20 group-hover/vol:opacity-100 transition-all duration-300 origin-left cursor-pointer accent-cyan-400"
              />
            </div>

            {/* Time */}
            <div className="text-white text-xs font-medium tracking-wide">
              {formatTime(currentTime)} <span className="text-gray-400 mx-1">/</span> {formatTime(durationTime)}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Playback Speed */}
            <div className="relative group/speed">
              <button className="text-white text-xs font-bold px-2 py-1 rounded hover:bg-white/10 transition-colors">
                {playbackRate}x
              </button>
              <div className="absolute bottom-full right-0 mb-2 bg-[#151923] rounded-lg shadow-xl border border-white/5 flex flex-col overflow-hidden opacity-0 invisible group-hover/speed:opacity-100 group-hover/speed:visible transition-all">
                {[0.5, 1, 1.25, 1.5, 2].map(rate => (
                  <button
                    key={rate}
                    onClick={() => { setPlaybackRate(rate); videoRef.current.playbackRate = rate; }}
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
                <button className="text-white text-xs font-bold px-2 py-1 rounded hover:bg-white/10 transition-colors flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  {currentLevel === -1 ? 'Auto' : `${levels[currentLevel]?.height}p`}
                </button>
                <div className="absolute bottom-full right-0 mb-2 bg-[#151923] rounded-lg shadow-xl border border-white/5 flex flex-col overflow-hidden opacity-0 invisible group-hover/quality:opacity-100 group-hover/quality:visible transition-all">
                  <button
                    onClick={() => {
                      if (hlsRef.current) hlsRef.current.currentLevel = -1;
                    }}
                    className={`px-4 py-2 text-xs text-left hover:bg-white/10 whitespace-nowrap ${currentLevel === -1 ? 'text-cyan-400 font-bold' : 'text-gray-300'}`}
                  >
                    Auto
                  </button>
                  {[...levels].reverse().map((level, index) => {
                    const originalIndex = levels.length - 1 - index;
                    return (
                      <button
                        key={originalIndex}
                        onClick={() => {
                          if (hlsRef.current) hlsRef.current.currentLevel = originalIndex;
                        }}
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
              <button onClick={togglePiP} className="text-white hover:text-cyan-400 transition-colors focus:outline-none" title="Picture in Picture">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11V9a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2h4m6 0v-4m0 0l-3 3m3-3l3 3" /></svg>
              </button>
            )}

            {/* Fullscreen */}
            <button onClick={toggleFullscreen} className="text-white hover:text-cyan-400 transition-colors focus:outline-none">
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
