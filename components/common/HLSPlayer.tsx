import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import Plyr from 'plyr';
import 'plyr/dist/plyr.css';
import { Loader2 } from 'lucide-react';
import { WEB_APP_URL } from '../../constants';

interface HLSPlayerProps {
  url: string;
  startTime?: number;
  onProgress?: (time: number, duration: number) => void;
  onReady?: (player: any) => void;
}

const HLSPlayer: React.FC<HLSPlayerProps> = ({ url, startTime = 0, onProgress, onReady }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<any>(null);
  const hlsRef = useRef<Hls | null>(null);
  
  const [finalUrl, setFinalUrl] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const proxyBaseUrl = window.location.hostname === 'localhost' 
      ? 'http://localhost:3001' 
      : WEB_APP_URL;

    const lowerUrl = url.toLowerCase();
    
    // 1. Check video types
    const isM3u8 = lowerUrl.includes('.m3u8') || 
                   url.includes('/hlsplaylist/') || 
                   url.includes('/hls/');
                   
    const isDirectVideo = lowerUrl.includes('.mp4') || 
                          lowerUrl.includes('.webm') || 
                          lowerUrl.includes('.ogg') || 
                          lowerUrl.includes('.mov') ||
                          lowerUrl.includes('.m4v');
    
    // If it's already a proxy URL, use it directly
    if (url.includes('/api/proxy-')) {
        setFinalUrl(url.startsWith('http') ? url : `${proxyBaseUrl}${url}`);
        setIsExtracting(false);
        return;
    }

    // If it's a direct M3U8, wrap it in our M3U8 proxy
    if (isM3u8) {
        setFinalUrl(`${proxyBaseUrl}/api/proxy-m3u8?url=${encodeURIComponent(url)}`);
        setIsExtracting(false);
        return;
    }

    // If it's a direct Video file (MP4, etc.), wrap it in our Video proxy
    if (isDirectVideo) {
        setFinalUrl(`${proxyBaseUrl}/api/proxy-video?url=${encodeURIComponent(url)}`);
        setIsExtracting(false);
        return;
    }

    // Otherwise, try to extract it (Assume it might be an iframe or a page containing a video)
    setIsExtracting(true);
    setError(null);
    
    let urlToExtract = url;
    if (url.includes('<iframe')) {
        const srcMatch = url.match(/src=["']([^"']+)["']/);
        if (srcMatch) urlToExtract = srcMatch[1];
    }

    const apiUrl = `${proxyBaseUrl}/api/extract-m3u8?url=${encodeURIComponent(urlToExtract)}`;
    
    fetch(apiUrl)
        .then(async res => {
            if (!res.ok) {
                const text = await res.text();
                throw new Error(text || `Server error: ${res.status}`);
            }
            return res.json();
        })
        .then(data => {
            if (data.m3u8Url) {
                setFinalUrl(`${proxyBaseUrl}/api/proxy-m3u8?url=${encodeURIComponent(data.m3u8Url)}`);
            } else {
                setError("Could not extract video stream.");
            }
        })
        .catch(err => {
            console.error("Extraction error:", err);
            setError("Failed to connect to video extractor.");
        })
        .finally(() => {
            setIsExtracting(false);
        });
  }, [url]);

  useEffect(() => {
    if (!videoRef.current || !finalUrl) return;

    const video = videoRef.current;
    const isM3u8 = finalUrl.includes('/api/proxy-m3u8');

    const initPlyr = () => {
      if (playerRef.current) {
        playerRef.current.destroy();
      }

      const player = new Plyr(video, {
        autoplay: true,
        settings: ['quality', 'speed', 'loop'],
        ratio: '16:9',
        keyboard: { focused: true, global: true },
        tooltips: { controls: true, seek: true },
        displayDuration: true,
      });

      player.on('ready', () => {
        if (startTime > 0) {
          player.currentTime = startTime;
        }
        if (onReady) onReady(player);
      });

      player.on('timeupdate', () => {
        if (onProgress) {
          onProgress(player.currentTime, player.duration);
        }
      });

      playerRef.current = player;
    };

    // If it's HLS (m3u8 proxy), use Hls.js
    if (isM3u8 && Hls.isSupported()) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }

      const hls = new Hls({
        maxBufferSize: 0,
        maxBufferLength: 30,
        enableWorker: true,
      });

      hls.loadSource(finalUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        initPlyr();
      });

      hlsRef.current = hls;
    } 
    // If it's HLS on Safari (native support)
    else if (isM3u8 && video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = finalUrl;
      video.addEventListener('loadedmetadata', () => {
        initPlyr();
      });
    }
    // If it's a direct video (MP4 proxy), play directly
    else {
      video.src = finalUrl;
      initPlyr();
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [finalUrl, startTime]);

  if (isExtracting) {
    return (
        <div className="w-full h-full bg-black flex flex-col items-center justify-center rounded-xl shadow-2xl">
            <Loader2 className="w-12 h-12 text-red-600 animate-spin mb-4" />
            <p className="text-white font-medium">កំពុងរៀបចំវីដេអូ...</p>
        </div>
    );
  }

  if (error && !finalUrl) {
    return (
        <div className="w-full h-full bg-black flex flex-col items-center justify-center rounded-xl shadow-2xl p-6 text-center">
            <p className="text-red-500 mb-4">{error}</p>
            <p className="text-gray-400 text-sm">សូមព្យាយាមម្ដងទៀត ឬប្រើ Link ផ្សេង។</p>
        </div>
    );
  }

  return (
    <div className="w-full h-full bg-black flex items-center justify-center overflow-hidden rounded-xl shadow-2xl">
      <video
        ref={videoRef}
        controls
        playsInline
        className="w-full h-full"
        style={{ '--plyr-color-main': '#e50914' } as any}
      />
    </div>
  );
};

export default HLSPlayer;
