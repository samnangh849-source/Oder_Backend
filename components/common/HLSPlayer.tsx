import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import * as PlyrModule from 'plyr';
const Plyr = (PlyrModule as any).default || PlyrModule;
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
  const [backupIframe, setBackupIframe] = useState<string | null>(null);
  const [swReady, setSwReady] = useState(false);

  // Register Service Worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js')
        .then(reg => {
          console.log('SW Registered:', reg.scope);
          // Wait for SW to be active and controlling the page
          if (navigator.serviceWorker.controller) {
            setSwReady(true);
          } else {
            navigator.serviceWorker.ready.then(() => {
                setSwReady(true);
                // Force reload if needed or just wait
                if (!navigator.serviceWorker.controller) {
                    window.location.reload();
                }
            });
          }
        })
        .catch(err => console.error('SW Registration failing:', err));
    } else {
        // Fallback for browsers without SW
        setSwReady(true);
    }
  }, []);

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
    // We only proceed if SW is ready (for local proxy)
    if (!swReady) return;

    const proxyBaseUrl = `${import.meta.env.BASE_URL}local-proxy`; // Use local SW proxy

    // Reset all states immediately when URL changes
    setFinalUrl(null);
    setUseIframeFallback(null);
    setError(null);
    setIsExtracting(false);
    setExtractStatus('');

    if (!url) return;

    // Google Drive direct iframe support
    if (url.includes('drive.google.com') || url.includes('docs.google.com/file')) {
        let fileId = null;
        if (url.includes('/file/d/')) {
            const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
            if (match) fileId = match[1];
        } else if (url.includes('id=')) {
            const match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
            if (match) fileId = match[1];
        }
        
        if (fileId) {
            setUseIframeFallback(`https://drive.google.com/file/d/${fileId}/preview`);
            setIsExtracting(false);
            return;
        }
    }

    // If it's already a local proxy URL, use it directly (Backward compatibility)
    if (url.includes('/local-proxy/') || url.includes('/api/proxy-')) {
        setFinalUrl(url);
        setIsExtracting(false);
        return;
    }

    // If it's a direct M3U8, wrap it in our robust Golang backend proxy
    if (isM3u8) {
        setFinalUrl(`${WEB_APP_URL}/api/proxy-m3u8?url=${encodeURIComponent(url)}`);
        setIsExtracting(false);
        return;
    }

    // If it's a direct Video file (MP4, etc.), wrap it in our Golang backend proxy
    if (isDirectVideo) {
        setFinalUrl(`${WEB_APP_URL}/api/proxy-ts?url=${encodeURIComponent(url)}`);
        setIsExtracting(false);
        return;
    }

    // Otherwise, try to extract it (Client-Side scraping with CORS Proxies)
    setIsExtracting(true);
    setExtractStatus('កំពុងទម្លុះយកលីងវីដេអូ (Scraping)...');
    
    let urlToExtract = url;
    if (url.includes('<iframe')) {
        const srcMatch = url.match(/src=["']([^"']+)["']/);
        if (srcMatch) urlToExtract = srcMatch[1];
    }

    const scrapeForM3U8 = async (targetUrl: string, depth = 0): Promise<{m3u8Url: string | null, fallbackIframe: string | null}> => {
        if (depth > 2) throw new Error("Max recursion depth reached");
        
        let origin = "";
        try { origin = new URL(targetUrl).origin; } catch(e) {}
        
        const bypassUrl = `${WEB_APP_URL}/api/fetch-json?url=${encodeURIComponent(targetUrl)}&referer=${encodeURIComponent(origin)}`;
        
        const res = await fetch(bypassUrl);
        if (!res.ok) throw new Error(`Scraper failed: ${res.status}`);
        const html = await res.text();

        let m3u8Url = null;
        
        // Match 1: JW Player playlist or standard file: "..." declarations
        const playlistMatch = html.match(/var playlist = (\[.*?\]);/s);
        if (playlistMatch) {
            try {
                const fileMatches = [...playlistMatch[1].matchAll(/file:\s*["']([^"']+)["']/g)];
                if (fileMatches.length > 0) m3u8Url = fileMatches[0][1];
            } catch (e) {}
        }
        
        if (!m3u8Url) {
            const fileMatch = html.match(/file:\s*["']([^"']+(?:\.m3u8|\/m3u8)[^"']*)["']/i);
            if (fileMatch) m3u8Url = fileMatch[1];
        }
        
        // Match 2: Direct m3u8 regex
        if (!m3u8Url) {
            // Find m3u8 urls or paths containing /hls/ but specifically exclude images
            const m3u8Regex = /(["'])(https?:\/\/[^"']+(?:\.m3u8|\/hlsplaylist\/|\/hls\/)[^"']*)\1/gi;
            let match;
            while ((match = m3u8Regex.exec(html)) !== null) {
                const matchedUrl = match[2];
                const lowerUrl = matchedUrl.toLowerCase();
                if (!lowerUrl.endsWith('.jpg') && !lowerUrl.endsWith('.jpeg') && !lowerUrl.endsWith('.png') && !lowerUrl.endsWith('.webp') && !lowerUrl.includes('.jpg?') && !lowerUrl.includes('.png?')) {
                    m3u8Url = matchedUrl;
                    break;
                }
            }
        }

        if (m3u8Url) {
            return { m3u8Url, fallbackIframe: null };
        }

        // Match 3: Look for iframe to recurse
        const iframeMatch = html.match(/<iframe[^>]+src=["']([^"']+)["']/i);
        if (iframeMatch) {
            let iframeSrc = iframeMatch[1];
            if (iframeSrc.startsWith('//')) iframeSrc = 'https:' + iframeSrc;
            else if (iframeSrc.startsWith('/') && origin) iframeSrc = origin + iframeSrc;
            return { m3u8Url: null, fallbackIframe: iframeSrc };
        }

        return { m3u8Url: null, fallbackIframe: null };
    };

    const executeScraping = async () => {
        try {
            // Start with the original URL as a fallback
            let backup: string | null = null;
            if (urlToExtract.includes('<iframe')) {
                 const srcMatch = urlToExtract.match(/src=["']([^"']+)["']/);
                 if (srcMatch) backup = srcMatch[1];
            }

            let result = await scrapeForM3U8(urlToExtract, 0);
            
            // If step 1 found a nested iframe embed, prefer THAT as the backup
            // (it's a clean player page, not the full article website!)
            if (result.fallbackIframe) {
                backup = result.fallbackIframe;
            } else if (!backup) {
                backup = urlToExtract; // Last resort: the original article URL
            }

            // Nested Iframe Logic — try to extract m3u8 from the embed iframe
            if (!result.m3u8Url && result.fallbackIframe) {
                 setExtractStatus('កំពុងទម្លុះកូដ Iframe (Deep Scraping)...');
                 result = await scrapeForM3U8(result.fallbackIframe, 1);
            }

            if (backup) setBackupIframe(backup);

            if (result.m3u8Url) {
                let finalM3u8 = result.m3u8Url;
                if (finalM3u8.startsWith('//')) finalM3u8 = 'https:' + finalM3u8;
                setExtractStatus('កំពុងរៀបចំការចាក់វីដេអូ (Backend Proxying)...');
                // Pass the original page URL as referer so the Go proxy can authenticate with the CDN
                let refererToPass = '';
                try {
                    refererToPass = new URL(urlToExtract).origin;
                } catch(e) { refererToPass = urlToExtract; }
                setFinalUrl(`${WEB_APP_URL}/api/proxy-m3u8?url=${encodeURIComponent(finalM3u8)}&referer=${encodeURIComponent(refererToPass)}`);
            } else if (result.fallbackIframe) {
                setUseIframeFallback(result.fallbackIframe);
            } else {
                setError("មិនអាចទាញយកលីងវីដេអូបានទេ។");
            }
        } catch (err) {
            console.error("Local extraction error:", err);
            setError("ការតភ្ជាប់ទៅកាន់ប្រព័ន្ធ Scraper បរាជ័យ។");
        } finally {
            setIsExtracting(false);
        }
    };
    
    executeScraping();
  }, [url, swReady]);

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

    // --- Auto-Rotate Logic (Mobile Only) ---
    const handleOrientationChange = () => {
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (!isMobile || !playerRef.current) return;

      const orientation = window.screen?.orientation?.type || (window as any).orientation;
      const isLandscape = orientation === 'landscape-primary' || orientation === 'landscape-secondary' || orientation === 90 || orientation === -90;

      if (isLandscape) {
        playerRef.current.fullscreen.enter();
      } else {
        if (playerRef.current.fullscreen.active) {
            playerRef.current.fullscreen.exit();
        }
      }
    };

    window.addEventListener('orientationchange', handleOrientationChange);
    if (screen.orientation) {
      screen.orientation.addEventListener('change', handleOrientationChange);
    }

    // If it's HLS (m3u8 proxy), use Hls.js
    const finalIsM3u8 = isM3u8 || finalUrl.toLowerCase().includes('.m3u8') || finalUrl.includes('proxy-m3u8');
    
    if (finalIsM3u8 && Hls.isSupported()) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }

      const hls = new Hls({
        maxBufferSize: 30 * 1024 * 1024, // 30MB
        maxBufferLength: 30,
        enableWorker: true,
        backBufferLength: 60,
        lowLatencyMode: true,
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.error("HLS Network Error:", data);
              if (backupIframe) {
                  console.warn("HLS Fatal Network Error. Auto-Failover to Iframe...");
                  setUseIframeFallback(backupIframe);
                  hls.destroy();
              } else {
                  hls.startLoad();
              }
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.error("HLS Media Error:", data);
              hls.recoverMediaError();
              break;
            default:
              console.error("HLS Fatal Error:", data);
              if (backupIframe) {
                  console.warn("HLS Fatal Unknown Error. Auto-Failover to Iframe...");
                  setUseIframeFallback(backupIframe);
              } else {
                  setError(`HLS Fatal Error: ${data.details}`);
              }
              hls.destroy();
              break;
          }
        }
      });

      hls.loadSource(finalUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        initPlyr();
      });

      hlsRef.current = hls;
    } 
    // If it's HLS on Safari (native support)
    else if (finalIsM3u8 && video.canPlayType('application/vnd.apple.mpegurl')) {
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
        hlsRef.current.detachMedia();
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
      
      window.removeEventListener('orientationchange', handleOrientationChange);
      if (screen.orientation) {
        screen.orientation.removeEventListener('change', handleOrientationChange);
      }
      
      // Prevent fetching destroyed blob URLs after unmount (Fix ERR_FILE_NOT_FOUND)
      if (video) {
        video.removeAttribute('src');
        video.load();
      }
    };
    // Exclude startTime from dependencies to prevent infinite unmount/mount loops when parent updates watch progress
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalUrl, isM3u8]);

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
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
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
