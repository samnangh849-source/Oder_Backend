import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import Plyr from 'plyr';
import 'plyr/dist/plyr.css';
import { Loader2, AlertCircle } from 'lucide-react';
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
  const [extractStatus, setExtractStatus] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [useIframeFallback, setUseIframeFallback] = useState<string | null>(null);

  const lowerUrl = url.toLowerCase();
  const isM3u8 = lowerUrl.includes('.m3u8') || 
                 url.includes('/hlsplaylist/') || 
                 url.includes('/hls/');
                 
  const isDirectVideo = lowerUrl.includes('.mp4') || 
                        lowerUrl.includes('.webm') || 
                        lowerUrl.includes('.ogg') || 
                        lowerUrl.includes('.mov') ||
                        lowerUrl.includes('.m4v');

  useEffect(() => {
    const proxyBaseUrl = WEB_APP_URL;

    // Reset all states immediately when URL changes
    setFinalUrl(null);
    setUseIframeFallback(null);
    setError(null);
    setIsExtracting(false);
    setExtractStatus('');

    if (!url) return;

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

    // Otherwise, try to extract it (Advanced Scraping)
    setIsExtracting(true);
    setExtractStatus('កំពុងទម្លុះយកលីងវីដេអូ (Scraping)...');
    
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
                const extracted = data.m3u8Url;
                // Check if extracted is actually an m3u8 or video
                const isStream = extracted.includes('.m3u8') || extracted.includes('.mp4') || extracted.includes('/hls/') || extracted.includes('/hlsplaylist/');
                
                if (isStream) {
                    setExtractStatus('កំពុងរៀបចំការចាក់វីដេអូ (HLS Proxying)...');
                    setFinalUrl(`${proxyBaseUrl}/api/proxy-m3u8?url=${encodeURIComponent(extracted)}`);
                } else {
                    // It's likely an iframe or player page, use fallback
                    setUseIframeFallback(extracted);
                }
            } else {
                setError("មិនអាចទាញយកលីងវីដេអូបានទេ។");
            }
        })
        .catch(err => {
            console.error("Extraction error:", err);
            setError("ការតភ្ជាប់ទៅកាន់ប្រព័ន្ធ Scraper បរាជ័យ។");
        })
        .finally(() => {
            setIsExtracting(false);
        });
  }, [url]);

  useEffect(() => {
    if (!videoRef.current || !finalUrl || useIframeFallback) return;

    const video = videoRef.current;
    // ... rest of HLS logic remains same ...


    const initPlyr = () => {
      if (playerRef.current) {
        playerRef.current.destroy();
      }

      const player = new Plyr(video, {
        autoplay: true,
        settings: ['quality', 'speed', 'loop'],
        keyboard: { focused: true, global: true },
        tooltips: { controls: true, seek: true },
        displayDuration: true,
      });

      // Override play to handle errors gracefully
      const originalPlay = player.play.bind(player);
      player.play = async () => {
        try {
          return await originalPlay();
        } catch (e) {
          if (e.name !== 'NotAllowedError' && e.name !== 'AbortError') {
             console.warn("Plyr play error:", e);
          }
        }
      };

      player.on('ready', () => {
        if (startTime > 0) {
          player.currentTime = startTime;
        }
        // Small delay to ensure everything is initialized
        setTimeout(() => {
          if (onReady) onReady(player);
        }, 100);
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
  }, [finalUrl, startTime, isM3u8]);

  if (isExtracting) {
    return (
        <div className="w-full h-full bg-black flex flex-col items-center justify-center rounded-xl shadow-2xl">
            <Loader2 className="w-12 h-12 text-red-600 animate-spin mb-4" />
            <p className="text-white font-medium mb-1">{extractStatus}</p>
            <p className="text-white/40 text-[10px] uppercase tracking-widest animate-pulse">Advanced Web Scraping Active</p>
        </div>
    );
  }

  if (useIframeFallback) {
    return (
      <div className="w-full h-full bg-black flex items-center justify-center overflow-hidden relative">
        <iframe 
          src={useIframeFallback} 
          className="w-full h-full border-none" 
          allowFullScreen 
          sandbox="allow-scripts allow-same-origin allow-presentation"
          referrerPolicy="no-referrer"
        />
        <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
           <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
           <span className="text-[10px] font-bold text-white/80 uppercase tracking-widest">Iframe Fallback Mode</span>
        </div>
      </div>
    );
  }

  if (error && !finalUrl) {
    return (
        <div className="w-full h-full bg-black flex flex-col items-center justify-center p-6 text-center">
            <AlertCircle className="w-10 h-10 text-red-600 mb-4" />
            <p className="text-red-500 mb-2 font-bold">{error}</p>
            <p className="text-gray-400 text-sm">សូមព្យាយាមម្ដងទៀត ឬប្រើប្រាស់ Link ផ្សេង។</p>
        </div>
    );
  }

  return (
    <div className="w-full h-full bg-black flex items-center justify-center overflow-hidden relative">
      <video
        ref={videoRef}
        controls
        playsInline
        crossOrigin="anonymous"
        preload="auto"
        className="w-full h-full object-contain"
        style={{ '--plyr-color-main': '#e50914' } as any}
      />
      <style dangerouslySetInnerHTML={{ __html: `
        .plyr {
          width: 100%;
          height: 100%;
        }
        .plyr__poster {
          background-size: cover !important;
          background-position: center !important;
          width: 100% !important;
          height: 100% !important;
        }
        .plyr--video {
          height: 100% !important;
        }
        .plyr__video-wrapper {
          height: 100% !important;
        }
      `}} />
    </div>
  );
};

export default HLSPlayer;
