import React, { useState, useRef, useEffect, useContext, useMemo } from 'react';
import { 
  Play, Loader2, AlertCircle, CheckCircle2, Server, Film, Copy, 
  Check, Code, Share2, Plus, X, Search, Info, ChevronLeft, Trash2
} from 'lucide-react';
import { AppContext } from '../../../context/AppContext';
import { Movie } from '../../../types';
import { translations } from '../../../translations';
import { WEB_APP_URL } from '../../../constants';
import Modal from '../../common/Modal';

interface DesktopNetflixEntertainmentProps {
  guestMovieId?: string;
  isTablet?: boolean;
}

const DesktopNetflixEntertainment: React.FC<DesktopNetflixEntertainmentProps> = ({ guestMovieId, isTablet }) => {
  const { currentUser, language, appState, setAppState, originalAdminUser, appData, refreshData, showNotification } = useContext(AppContext);
  const t = translations[language];
  const isAdmin = currentUser?.IsSystemAdmin || (currentUser?.Role && currentUser.Role.toLowerCase() === 'admin');
  const hasBanner = !!originalAdminUser;

  // Use movies from AppData
  const [localMovies, setLocalMovies] = useState<Movie[]>([]);
  const movies = useMemo(() => (appData?.movies?.length ? appData.movies : localMovies), [appData?.movies, localMovies]);

  // Fetch movies if not available (e.g. in guest mode)
  useEffect(() => {
    if (!appData?.movies?.length) {
        const fetchMovies = async () => {
            try {
                const response = await fetch(`${WEB_APP_URL}/api/movies`);
                if (response.ok) {
                    const result = await response.json();
                    if (result.status === 'success') {
                        setLocalMovies(result.data || []);
                    }
                }
            } catch (e) {
                console.error("Failed to fetch movies for guest", e);
            }
        };
        fetchMovies();
    }
  }, [appData?.movies]);
  
  const [activeMovie, setActiveMovie] = useState<Movie | null>(null);
  const [billboardMovie, setBillboardMovie] = useState<Movie | null>(null);
  const [activeTab, setActiveTab] = useState<'home' | 'tv' | 'movies' | 'mylist' | 'games'>('home');
  const [myList, setMyList] = useState<string[]>(() => {
    const saved = localStorage.getItem('entertainment_mylist');
    return saved ? JSON.parse(saved) : [];
  });
  const [showDetails, setShowDetails] = useState<Movie | null>(null);

  // Continue Watching State
  const [watchProgress, setWatchProgress] = useState<Record<string, {time: number, duration: number}>>(() => {
    const saved = localStorage.getItem('movie_progress');
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'movie_progress' && event.data?.id) {
        setWatchProgress(prev => {
          const updated = {
            ...prev,
            [event.data.id]: { time: event.data.time, duration: event.data.duration }
          };
          localStorage.setItem('movie_progress', JSON.stringify(updated));
          return updated;
        });
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  useEffect(() => {
    localStorage.setItem('entertainment_mylist', JSON.stringify(myList));
  }, [myList]);

  const toggleMyList = (id: string) => {
    setMyList(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  useEffect(() => {
    if (movies.length > 0) {
      setBillboardMovie(movies[0]);
    }
  }, [movies]);

  useEffect(() => {
    if (guestMovieId && movies.length > 0) {
      const movie = movies.find(m => m.ID === guestMovieId);
      if (movie) setActiveMovie(movie);
    }
  }, [guestMovieId, movies]);

  const [searchQuery, setSearchQuery] = useState('');
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = (e: any) => {
        setScrolled(e.target.scrollTop > 50);
    };
    const container = document.getElementById('app-main-scroll-container');
    if (container) {
        container.addEventListener('scroll', handleScroll);
        return () => container.removeEventListener('scroll', handleScroll);
    }
  }, []);

  // Admin HLS Proxy State
  const [showProxy, setShowProxy] = useState(false);
  const [inputUrl, setInputUrl] = useState('');
  const [inputType, setInputType] = useState<'url' | 'source'>('url');
  const [inputSource, setInputSource] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [extractedM3u8, setExtractedM3u8] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Modal for Adding Movie
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newMovie, setNewMovie] = useState<Partial<Movie>>({
    Type: 'long',
    Language: 'Khmer',
    Country: 'Cambodia'
  });

  const iframeContainerRef = useRef<HTMLDivElement>(null);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleShare = (movie: Movie) => {
    const shareUrl = `${window.location.origin}${window.location.pathname}?view=watch&movie=${movie.ID}`;
    handleCopy(shareUrl);
    alert('Link shared to clipboard!');
  };

  const handleFetchVideo = async () => {
    setStatus('loading');
    setExtractedM3u8(null);
    setErrorMessage(null);

    try {
      let htmlContent = '';
      if (inputType === 'url') {
        const proxies = [
          `${WEB_APP_URL}/api/fetch-json?url=${encodeURIComponent(inputUrl)}`,
          `https://api.allorigins.win/get?url=${encodeURIComponent(inputUrl)}`,
          `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(inputUrl)}`
        ];

        let fetchSuccess = false;
        for (const proxyUrl of proxies) {
          try {
            const response = await fetch(proxyUrl);
            if (!response.ok) continue;
            const data = await response.json();
            htmlContent = data.contents || await response.text();
            if (htmlContent) { fetchSuccess = true; break; }
          } catch (e) { console.warn(e); }
        }
        if (!fetchSuccess) throw new Error("មិនអាចទាញយកបានទេ។ អាចមកពី Network របស់អ្នកមានបញ្ហា។");
      } else {
        htmlContent = inputSource;
        if (!htmlContent.trim()) throw new Error("សូមបញ្ចូលកូដដើម (Page Source) ជាមុនសិន។");
      }

      const playlistsMatch = htmlContent.match(/const playlists = (\[.*?\]);/s);
      if (playlistsMatch) {
        const fileMatches = [...playlistsMatch[1].matchAll(/file:\s*["']([^"']+)["']/g)];
        if (fileMatches.length > 0) {
          let url = fileMatches[0][1];
          if (url.startsWith('//')) url = 'https:' + url;
          setExtractedM3u8(url);
          setStatus('success');
          return;
        }
      }

      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, "text/html");
      const playerOptions = doc.querySelectorAll('.dooplay_player_option');
      
      if (playerOptions.length > 0) {
        let playerApi = '';
        let ajaxUrlBase = '';
        const dtAjaxMatch = htmlContent.match(/var dtAjax = (\{.*?\});/);
        if (dtAjaxMatch) {
          try {
            const dtAjax = JSON.parse(dtAjaxMatch[1]);
            playerApi = dtAjax.player_api || '';
            ajaxUrlBase = dtAjax.url || '';
          } catch (e) {}
        }

        if (playerApi || ajaxUrlBase) {
          let firstOption = playerOptions[0];
          for (let i = 0; i < playerOptions.length; i++) {
            if (playerOptions[i].getAttribute('data-nume') !== 'trailer') {
              firstOption = playerOptions[i];
              break;
            }
          }
          const postId = firstOption.getAttribute('data-post');
          const nume = firstOption.getAttribute('data-nume');
          const type = firstOption.getAttribute('data-type');
          
          if (postId && nume && type) {
            const fetchUrl = playerApi ? `${playerApi}${postId}/${type}/${nume}` : `${ajaxUrlBase}?action=doo_player_ajax&post=${postId}&nume=${nume}&type=${type}`;
            const res = await fetch(`${WEB_APP_URL}/api/fetch-json?url=${encodeURIComponent(fetchUrl)}`, {
                method: (ajaxUrlBase && !playerApi) ? 'POST' : 'GET'
            });
            if (res.ok) {
              const embedData = await res.json();
              let embedUrl = embedData.embed_url || '';
              if (embedUrl.includes('<iframe')) {
                const iframeMatch = embedUrl.match(/src=["']([^"']+)["']/);
                if (iframeMatch) embedUrl = iframeMatch[1];
              }
              if (embedUrl) {
                const extractRes = await fetch(`${WEB_APP_URL}/api/extract-m3u8?url=${encodeURIComponent(embedUrl)}`);
                if (extractRes.ok) {
                  const extractData = await extractRes.json();
                  if (extractData.m3u8Url) {
                    setExtractedM3u8(extractData.m3u8Url);
                    setStatus('success');
                    return;
                  }
                }
                setExtractedM3u8(embedUrl);
                setStatus('success');
                return;
              }
            }
          }
        }
      }

      const iframes = doc.querySelectorAll('.movieplay iframe, iframe, .embed-container iframe');
      if (iframes.length > 0) {
        let src = '';
        for (let i = 0; i < iframes.length; i++) {
          const iframeSrc = (iframes[i] as HTMLIFrameElement).src;
          if (iframeSrc && !iframeSrc.includes('googletagmanager') && !iframeSrc.includes('facebook')) {
            src = iframeSrc;
            break;
          }
        }
        if (src) {
          const extractRes = await fetch(`${WEB_APP_URL}/api/extract-m3u8?url=${encodeURIComponent(src)}`);
          if (extractRes.ok) {
            const data = await extractRes.json();
            if (data.m3u8Url) {
              setExtractedM3u8(data.m3u8Url);
              setStatus('success');
              return;
            }
          }
          setExtractedM3u8(src);
          setStatus('success');
          return;
        }
      }

      const m3u8Matches = [...htmlContent.matchAll(/(https?:\/\/[^\s"'<>]+?\.m3u8[^\s"'<>]*)/gi)];
      let foundM3u8 = null;
      for (const match of m3u8Matches) {
        const url = match[1];
        if (!url.includes('ads') && !url.includes('videoAd')) {
          foundM3u8 = url;
          break;
        }
      }
      if (foundM3u8) {
        setExtractedM3u8(foundM3u8);
        setStatus('success');
      } else {
        throw new Error("រកមិនឃើញលីងវីដេអូ ឬ Iframe នៅក្នុងកូដនេះទេ។");
      }
    } catch (err: any) {
      setErrorMessage(err.message);
      setStatus('error');
    }
  };

  const addMovieToStore = async () => {
    if (!newMovie.Title || !newMovie.VideoURL) return;
    setIsSubmitting(true);
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${WEB_APP_URL}/api/admin/movies`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(newMovie)
        });
        if (response.ok) {
            await refreshData();
            setShowAddModal(false);
            setNewMovie({ Type: 'long', Language: 'Khmer', Country: 'Cambodia' });
            showNotification("ភាពយន្តត្រូវបានបន្ថែម", "success");
        }
    } catch (e) { console.error(e); } finally { setIsSubmitting(false); }
  };

  const deleteMovie = async (id: string) => {
    if (confirm('Delete this movie?')) {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${WEB_APP_URL}/api/admin/movies/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                await refreshData();
                showNotification("ភាពយន្តត្រូវបានលុប", "info");
            }
        } catch (e) { console.error(e); }
    }
  };

  const filteredMovies = movies.filter(m => {
    const matchesSearch = m.Title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = activeTab === 'home' || 
                       (activeTab === 'movies' && m.Type === 'long') ||
                       (activeTab === 'tv' && m.Type === 'series') ||
                       (activeTab === 'mylist' && myList.includes(m.ID));
    return matchesSearch && matchesTab;
  });

  const trendingMovies = [...movies].sort((a, b) => new Date(b.AddedAt || 0).getTime() - new Date(a.AddedAt || 0).getTime()).slice(0, 5);
  const shortFilms = movies.filter(m => m.Type === 'short');
  const longFilms = movies.filter(m => m.Type === 'long');
  const series = movies.filter(m => m.Type === 'series');

  // Calculate Continue Watching
  const continueWatchingMovies = movies.filter(m => {
    const prog = watchProgress[m.ID];
    return prog && prog.time > 10 && prog.time < prog.duration - 30; // Watched more than 10s and not finished
  });

  // Hero Slider Logic
  const heroMovies = trendingMovies.length > 0 ? trendingMovies : movies.slice(0, 5);
  const [heroIndex, setHeroIndex] = useState(0);

  useEffect(() => {
    if (activeTab === 'home' && !activeMovie && heroMovies.length > 0) {
      const interval = setInterval(() => {
        setHeroIndex(prev => (prev + 1) % heroMovies.length);
      }, 8000);
      return () => clearInterval(interval);
    }
  }, [activeTab, activeMovie, heroMovies.length]);

  useEffect(() => {
    if (heroMovies.length > 0) {
      setBillboardMovie(heroMovies[heroIndex]);
    }
  }, [heroIndex, heroMovies]);

  // Categories filter
  const allCategories = Array.from(new Set(movies.map(m => m.Category).filter(Boolean)));
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const finalFilteredMovies = selectedCategory 
    ? filteredMovies.filter(m => m.Category === selectedCategory)
    : filteredMovies;

  useEffect(() => {
    if (activeMovie && iframeContainerRef.current) {
      const container = iframeContainerRef.current;
      container.innerHTML = '';
      const isM3u8 = activeMovie.VideoURL.includes('.m3u8');
      const proxyM3u8Url = `${WEB_APP_URL}/api/proxy-m3u8?url=${encodeURIComponent(activeMovie.VideoURL)}`;
      const proxyUrl = `${WEB_APP_URL}/api/proxy-video?url=${encodeURIComponent(activeMovie.VideoURL)}`;
      
      let playerHtml = '';
      const savedProgressStr = localStorage.getItem('movie_progress');
      const savedProgress = savedProgressStr ? JSON.parse(savedProgressStr) : {};
      const startTime = savedProgress[activeMovie.ID]?.time || 0;

      if (isM3u8) {
        playerHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=0">
            <meta name="referrer" content="no-referrer">
            <link rel="stylesheet" href="https://cdn.plyr.io/3.7.8/plyr.css" />
            <style>
              :root { --plyr-color-main: #e50914; }
              body { margin: 0; background: #000; display: flex; align-items: center; justify-content: center; height: 100vh; overflow: hidden; font-family: sans-serif; }
              video { width: 100%; height: 100%; outline: none; background: #000; }
            </style>
          </head>
          <body>
            <video id="video" controls playsinline></video>
            <script src="https://cdn.jsdelivr.net/npm/hls.js@1.5.7/dist/hls.min.js"></script>
            <script src="https://cdn.plyr.io/3.7.8/plyr.polyfilled.js"></script>
            <script>
              document.addEventListener('DOMContentLoaded', () => {
                const video = document.getElementById('video');
                const url = '${proxyM3u8Url}';
                const defaultOptions = {};
                let player;

                function initPlayer() {
                  player = new Plyr(video, {
                    autoplay: true,
                    settings: ['quality', 'speed', 'loop'],
                    quality: { default: 720, options: [1080, 720, 480, 360] }
                  });
                  
                  // Resume playback
                  player.on('ready', () => {
                     if (${startTime} > 0) {
                         player.currentTime = ${startTime};
                     }
                  });

                  // Sync progress to parent
                  player.on('timeupdate', () => {
                    if(player.currentTime > 0) {
                      window.parent.postMessage({ type: 'movie_progress', id: '${activeMovie.ID}', time: player.currentTime, duration: player.duration }, '*');
                    }
                  });
                }

                if (Hls.isSupported()) {
                  const hls = new Hls();
                  hls.loadSource(url);
                  hls.attachMedia(video);
                  hls.on(Hls.Events.MANIFEST_PARSED, function (event, data) {
                    const availableQualities = hls.levels.map((l) => l.height);
                    defaultOptions.quality = {
                      default: availableQualities[0],
                      options: availableQualities,
                      forced: true,
                      onChange: (e) => updateQuality(e),
                    };
                    initPlayer();
                  });
                  window.hls = hls;
                } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                  video.src = url;
                  initPlayer();
                }
              });
            </script>
          </body>
          </html>
        `;
      } else if (activeMovie.VideoURL.includes('<iframe')) {
        playerHtml = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=0"><style>body{margin:0;background:#000;display:flex;align-items:center;justify-content:center;height:100vh;overflow:hidden;}iframe{width:100%;height:100%;border:none;}</style></head><body>${activeMovie.VideoURL}</body></html>`;
      } else {
        playerHtml = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=0"><style>body{margin:0;background:#000;display:flex;align-items:center;justify-content:center;height:100vh;overflow:hidden;}iframe{width:100%;height:100%;border:none;}</style></head><body><iframe src="${proxyUrl}" allowfullscreen="true" frameborder="0"></iframe></body></html>`;
      }

      const iframe = document.createElement('iframe');
      iframe.style.width = '100%';
      iframe.style.height = '100%';
      iframe.style.border = 'none';
      iframe.allowFullscreen = true;
      iframe.srcdoc = playerHtml;
      container.appendChild(iframe);
    }
  }, [activeMovie]);

  const MovieRow = ({ title, items }: { title: string, items: Movie[] }) => {
    if (items.length === 0) return null;
    return (
      <div className="mb-8 px-12">
        <h3 className="text-xl font-bold mb-4 uppercase tracking-tight">{title}</h3>
        <div className="flex gap-4 overflow-x-auto pb-8 no-scrollbar scroll-smooth">
          {items.map(movie => {
            const progress = watchProgress[movie.ID];
            const progressPercent = progress ? (progress.time / progress.duration) * 100 : 0;
            return (
              <div key={movie.ID} className="relative min-w-[240px] aspect-[2/3] group cursor-pointer transition-all hover:scale-105" onClick={() => setActiveMovie(movie)}>
                <img src={movie.Thumbnail} alt={movie.Title} className="w-full h-full object-cover rounded-md shadow-lg" />
                
                {/* Progress Bar */}
                {progressPercent > 0 && progressPercent < 95 && (
                  <div className="absolute bottom-0 left-0 w-full h-1 bg-gray-700/50 rounded-b-md overflow-hidden">
                    <div className="h-full bg-red-600" style={{ width: `${progressPercent}%` }}></div>
                  </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-4 flex flex-col justify-end rounded-md">
                  <h4 className="font-bold text-sm mb-1">{movie.Title}</h4>
                  <div className="text-[10px] text-gray-300 mb-2 flex gap-2">
                    {movie.Category && <span className="bg-white/10 px-1.5 py-0.5 rounded">{movie.Category}</span>}
                    {movie.Language && <span>{movie.Language}</span>}
                  </div>
                  <div className="flex gap-2">
                    <button className="bg-white text-black p-2 rounded-full"><Play className="w-3 h-3 fill-current" /></button>
                    <button onClick={(e) => { e.stopPropagation(); toggleMyList(movie.ID); }} className="bg-white/20 p-2 rounded-full">{myList.includes(movie.ID) ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}</button>
                    {isAdmin && <button onClick={(e) => { e.stopPropagation(); deleteMovie(movie.ID); }} className="bg-red-500/20 p-2 rounded-full ml-auto hover:bg-red-500/50 transition-colors"><Trash2 className="w-3 h-3" /></button>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#080808] text-white font-['Kantumruy_Pro']">
      <nav className={`fixed w-full z-[60] px-10 py-4 flex items-center justify-between transition-all ${scrolled ? 'bg-black/80 backdrop-blur-md' : 'bg-gradient-to-b from-black to-transparent'}`} style={{ top: hasBanner ? '44px' : '0' }}>
        <div className="flex items-center gap-10">
          <button onClick={() => setAppState('role_selection')} className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-all"><ChevronLeft className="w-6 h-6" /></button>
          <div className="flex flex-col">
            <h1 className="text-2xl font-black italic">O-<span className="text-red-600">ENTERTAINMENT</span></h1>
            <span className="text-[8px] opacity-30 uppercase tracking-widest">Premium System</span>
          </div>
          <div className="hidden lg:flex gap-8 text-[11px] font-black uppercase opacity-40">
            {['home', 'tv', 'movies', 'mylist'].map(tab => (
              <button key={tab} onClick={() => { setActiveTab(tab as any); setSelectedCategory(null); }} className={`transition-colors ${activeTab === tab ? 'text-white opacity-100 font-bold' : 'hover:opacity-100'}`}>{tab}</button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search titles..." className="bg-white/5 border border-white/10 rounded-full py-2 pl-10 pr-4 text-xs outline-none focus:bg-white/10 focus:border-white/30 transition-all w-48" />
          </div>
          {isAdmin && (
            <>
              <button onClick={() => setShowAddModal(true)} className="p-2 bg-white/5 rounded-full border border-white/10 hover:bg-red-600 hover:border-red-600 transition-colors"><Plus className="w-4 h-4" /></button>
              <button onClick={() => setShowProxy(!showProxy)} className={`p-2 rounded-full border transition-colors ${showProxy ? 'bg-red-600 border-red-500' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}><Server className="w-4 h-4" /></button>
            </>
          )}
        </div>
      </nav>

      {billboardMovie && activeTab === 'home' && !searchQuery && !selectedCategory && (
        <div className="relative w-full h-[85vh] transition-opacity duration-1000">
          <img key={billboardMovie.ID} src={billboardMovie.Thumbnail} alt={billboardMovie.Title} className="w-full h-full object-cover animate-[fade-in_1s_ease-out]" />
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/60 to-transparent flex flex-col justify-center px-12">
            <h2 className="text-7xl font-black italic uppercase mb-4 max-w-4xl leading-tight drop-shadow-2xl">{billboardMovie.Title}</h2>
            <div className="flex gap-4 items-center mb-6 text-sm font-bold text-gray-300">
              <span className="text-green-400">98% Match</span>
              <span>{billboardMovie.AddedAt ? new Date(billboardMovie.AddedAt).getFullYear() : new Date().getFullYear()}</span>
              {billboardMovie.Type && <span className="border border-gray-500 px-2 rounded text-[10px] uppercase">{billboardMovie.Type}</span>}
              {billboardMovie.Category && <span>{billboardMovie.Category}</span>}
            </div>
            <p className="text-lg text-gray-300 max-w-2xl mb-8 leading-relaxed line-clamp-3 drop-shadow-md">{billboardMovie.Description || "No description available for this title."}</p>
            <div className="flex gap-4">
              <button onClick={() => setActiveMovie(billboardMovie)} className="bg-white text-black hover:bg-gray-200 transition-colors px-8 py-3 rounded font-black flex items-center gap-3 shadow-xl"><Play className="w-6 h-6 fill-current" /> Play</button>
              <button onClick={() => setShowDetails(billboardMovie)} className="bg-gray-500/50 hover:bg-gray-500/70 transition-colors px-8 py-3 rounded font-black flex items-center gap-3 backdrop-blur-md text-white"><Info className="w-6 h-6" /> More Info</button>
            </div>
          </div>
          <div className="absolute bottom-0 w-full h-32 bg-gradient-to-t from-[#080808] to-transparent"></div>
        </div>
      )}

      <main className={`relative z-10 ${(billboardMovie && activeTab === 'home' && !searchQuery && !selectedCategory) ? '-mt-32' : 'pt-32'} pb-20`}>
        
        {/* Category Filters */}
        {allCategories.length > 0 && !searchQuery && activeTab !== 'mylist' && (
          <div className="px-12 mb-8 flex gap-3 overflow-x-auto no-scrollbar">
            <button onClick={() => setSelectedCategory(null)} className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${!selectedCategory ? 'bg-white text-black' : 'bg-white/10 hover:bg-white/20'}`}>All</button>
            {allCategories.map(cat => (
              <button key={cat} onClick={() => setSelectedCategory(cat as string)} className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${selectedCategory === cat ? 'bg-white text-black' : 'bg-white/10 hover:bg-white/20'}`}>{cat}</button>
            ))}
          </div>
        )}

        {showProxy && isAdmin && (
          <div className="mx-12 bg-black/80 border border-red-600/30 rounded-2xl p-8 mb-12 backdrop-blur-xl animate-[fade-in_0.3s_ease-out]">
            <h2 className="text-2xl font-black mb-6 flex items-center gap-3 italic"><Server className="w-8 h-8 text-red-600" /> Advanced HLS Proxy</h2>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <button onClick={() => setInputType('url')} className={`p-4 rounded-xl border-2 transition-all font-black ${inputType === 'url' ? 'border-red-600 bg-red-600/10 text-red-600' : 'border-white/10'}`}>Direct URL</button>
              <button onClick={() => setInputType('source')} className={`p-4 rounded-xl border-2 transition-all font-black ${inputType === 'source' ? 'border-red-600 bg-red-600/10 text-red-600' : 'border-white/10'}`}>HTML Source</button>
            </div>
            {inputType === 'url' ? (
              <input type="text" value={inputUrl} onChange={(e) => setInputUrl(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl p-4 mb-6 outline-none focus:border-red-600" placeholder="Paste link..." />
            ) : (
              <textarea value={inputSource} onChange={(e) => setInputSource(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl p-4 mb-6 outline-none focus:border-red-600 h-40 font-mono text-xs" placeholder="Paste HTML..." />
            )}
            <button onClick={handleFetchVideo} disabled={status === 'loading'} className="w-full bg-red-600 font-black py-4 rounded-xl transition-all shadow-xl active:scale-[0.98]">
              {status === 'loading' ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : 'Extract & Bypass Stream'}
            </button>
            {extractedM3u8 && (
              <div className="mt-8 p-6 bg-green-500/5 border border-green-500/20 rounded-xl">
                <div className="flex justify-between mb-4"><span className="text-green-400 font-black flex items-center gap-3"><CheckCircle2 className="w-5 h-5" /> Decrypted</span><button onClick={() => handleCopy(extractedM3u8)}><Copy className="w-5 h-5" /></button></div>
                <div className="text-[10px] break-all font-mono text-gray-500 bg-black/40 p-4 rounded-lg mb-6">{extractedM3u8}</div>
                <button onClick={() => { setNewMovie({ ...newMovie, VideoURL: extractedM3u8 }); setShowAddModal(true); }} className="w-full bg-green-600 text-white font-black py-3 rounded-xl uppercase tracking-widest">Create Entry</button>
              </div>
            )}
            {status === 'error' && <div className="mt-6 text-red-400 text-sm flex items-center gap-3 bg-red-600/10 p-4 rounded-xl"><AlertCircle className="w-5 h-5" /> {errorMessage}</div>}
          </div>
        )}
        
        {/* Rows */}
        {continueWatchingMovies.length > 0 && !searchQuery && !selectedCategory && activeTab === 'home' && (
          <MovieRow title="Continue Watching" items={continueWatchingMovies} />
        )}
        <MovieRow title={selectedCategory ? `${selectedCategory} Movies` : "Trending Now"} items={selectedCategory ? finalFilteredMovies : trendingMovies} />
        {!selectedCategory && (
          <>
            <MovieRow title="Khmer Series" items={series} />
            <MovieRow title="Feature Movies" items={longFilms} />
            <MovieRow title="Short Films" items={shortFilms} />
          </>
        )}
      </main>

      {activeMovie && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col animate-[fade-in_0.3s_ease-out]">
          <div className="p-10 flex items-center justify-between bg-gradient-to-b from-black via-black/80 to-transparent relative z-10">
            <button onClick={() => setActiveMovie(null)} className="text-white hover:scale-110 hover:text-red-500 transition-all bg-black/50 p-3 rounded-full backdrop-blur-md"><X className="w-8 h-8" /></button>
            <h2 className="text-3xl font-black italic drop-shadow-xl">{activeMovie.Title}</h2>
            <button onClick={() => handleShare(activeMovie)} className="bg-white/10 hover:bg-white/20 transition-colors px-6 py-3 rounded-full text-xs font-black uppercase tracking-widest flex items-center gap-2"><Share2 className="w-4 h-4" /> Share</button>
          </div>
          <div className="flex-1 w-full max-w-[1600px] mx-auto relative rounded-xl overflow-hidden shadow-2xl mb-10" ref={iframeContainerRef}></div>
          
          {/* Similar Movies in Player View */}
          <div className="px-10 pb-10">
            <h3 className="text-xl font-bold mb-4 uppercase opacity-50">More Like This</h3>
            <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
              {movies.filter(m => m.ID !== activeMovie.ID && (m.Category === activeMovie.Category || m.Type === activeMovie.Type)).slice(0, 10).map(movie => (
                <div key={movie.ID} className="min-w-[160px] aspect-[2/3] cursor-pointer hover:scale-105 transition-transform" onClick={() => setActiveMovie(movie)}>
                  <img src={movie.Thumbnail} className="w-full h-full object-cover rounded-md" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showDetails && (
         <Modal isOpen={!!showDetails} onClose={() => setShowDetails(null)} title="Movie Details">
           <div className="text-white p-4">
             <img src={showDetails.Thumbnail} className="w-full h-64 object-cover rounded-xl mb-6 shadow-xl" />
             <h2 className="text-3xl font-black italic mb-2">{showDetails.Title}</h2>
             <div className="flex gap-3 text-sm text-gray-400 mb-6 font-bold">
                <span>{showDetails.AddedAt ? new Date(showDetails.AddedAt).getFullYear() : '2024'}</span>
                {showDetails.Type && <span className="border border-gray-600 px-2 rounded uppercase text-[10px] flex items-center">{showDetails.Type}</span>}
                {showDetails.Category && <span className="text-gray-300">{showDetails.Category}</span>}
             </div>
             <p className="text-gray-300 leading-relaxed mb-8">{showDetails.Description || "No description available."}</p>
             <button onClick={() => { setShowDetails(null); setActiveMovie(showDetails); }} className="w-full bg-white text-black font-black py-4 rounded-xl flex items-center justify-center gap-3 hover:bg-gray-200 transition-colors"><Play className="w-6 h-6 fill-current" /> Play Now</button>
           </div>
         </Modal>
      )}

      {showAddModal && (
        <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title={t.add_movie}>
          <div className="space-y-4 text-white p-2 max-h-[70vh] overflow-y-auto no-scrollbar">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="col-span-1 md:col-span-2 relative">
                <label className="text-[10px] text-gray-500 font-black uppercase mb-1 block">{t.title}</label>
                <div className="flex gap-2">
                  <input type="text" value={newMovie.Title || ''} onChange={(e) => setNewMovie({ ...newMovie, Title: e.target.value })} className="flex-1 bg-white/5 border border-white/10 rounded-xl p-3 outline-none focus:border-red-600 transition-colors" placeholder="Movie Title" />
                  <button 
                    onClick={async () => {
                      if(!newMovie.Title) return;
                      setIsSubmitting(true);
                      try {
                        // Smart Fetch using TVMaze API as a free public alternative for series/movies
                        const res = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(newMovie.Title)}`);
                        const data = await res.json();
                        if(data && data.length > 0) {
                           const show = data[0].show;
                           setNewMovie(prev => ({
                             ...prev,
                             Title: show.name || prev.Title,
                             Description: show.summary ? show.summary.replace(/<[^>]*>?/gm, '') : prev.Description,
                             Category: show.genres ? show.genres.join(', ') : prev.Category,
                             Language: show.language || prev.Language,
                             Thumbnail: show.image ? show.image.original : prev.Thumbnail,
                             Type: show.type === 'Scripted' ? 'series' : 'long'
                           }));
                           showNotification("Smart Fetch Complete!", "success");
                        } else {
                           showNotification("No smart data found. Enter manually.", "warning");
                        }
                      } catch(e) {
                         showNotification("Smart Fetch failed.", "error");
                      }
                      setIsSubmitting(false);
                    }}
                    className="bg-blue-600 hover:bg-blue-700 px-4 rounded-xl font-bold text-xs flex items-center gap-2 transition-colors disabled:opacity-50"
                    disabled={!newMovie.Title || isSubmitting}
                  >
                    <Search className="w-4 h-4" /> Smart Fetch
                  </button>
                </div>
              </div>
              
              <div className="col-span-1 md:col-span-2">
                <label className="text-[10px] text-gray-500 font-black uppercase mb-1 block">Description</label>
                <textarea value={newMovie.Description || ''} onChange={(e) => setNewMovie({ ...newMovie, Description: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 outline-none focus:border-red-600 transition-colors h-24 resize-none" placeholder="Movie description..." />
              </div>

              <div>
                <label className="text-[10px] text-gray-500 font-black uppercase mb-1 block">Type</label>
                <select value={newMovie.Type || 'long'} onChange={(e) => setNewMovie({ ...newMovie, Type: e.target.value as any })} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 outline-none focus:border-red-600 transition-colors appearance-none">
                  <option value="long" className="bg-[#1a1a1a]">Feature Movie</option>
                  <option value="short" className="bg-[#1a1a1a]">Short Film</option>
                  <option value="series" className="bg-[#1a1a1a]">TV Series</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-gray-500 font-black uppercase mb-1 block">Category</label>
                <input type="text" value={newMovie.Category || ''} onChange={(e) => setNewMovie({ ...newMovie, Category: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 outline-none focus:border-red-600 transition-colors" placeholder="e.g. Action, Drama" />
              </div>

              <div>
                <label className="text-[10px] text-gray-500 font-black uppercase mb-1 block">Language</label>
                <input type="text" value={newMovie.Language || 'Khmer'} onChange={(e) => setNewMovie({ ...newMovie, Language: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 outline-none focus:border-red-600 transition-colors" placeholder="Language" />
              </div>

              <div>
                <label className="text-[10px] text-gray-500 font-black uppercase mb-1 block">Country</label>
                <input type="text" value={newMovie.Country || 'Cambodia'} onChange={(e) => setNewMovie({ ...newMovie, Country: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 outline-none focus:border-red-600 transition-colors" placeholder="Country" />
              </div>

              <div className="col-span-1 md:col-span-2">
                <label className="text-[10px] text-gray-500 font-black uppercase mb-1 block">{t.m3u8_link}</label>
                <input type="text" value={newMovie.VideoURL || ''} onChange={(e) => setNewMovie({ ...newMovie, VideoURL: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 outline-none focus:border-red-600 transition-colors" placeholder="HLS/M3U8 or Embed URL" />
              </div>
              
              <div className="col-span-1 md:col-span-2">
                <label className="text-[10px] text-gray-500 font-black uppercase mb-1 block">{t.thumbnail_url}</label>
                <input type="text" value={newMovie.Thumbnail || ''} onChange={(e) => setNewMovie({ ...newMovie, Thumbnail: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 outline-none focus:border-red-600 transition-colors" placeholder="Image URL" />
              </div>
            </div>

            <div className="pt-4">
              <button 
                onClick={addMovieToStore} 
                disabled={isSubmitting}
                className="w-full bg-red-600 font-black py-4 rounded-xl shadow-xl transition-all hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                {isSubmitting ? 'Saving...' : 'Save Movie'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default DesktopNetflixEntertainment;
