import React, { useState, useRef, useEffect, useContext, useMemo } from 'react';
import { 
  Play, Loader2, AlertCircle, CheckCircle2, Server, Film, Copy, 
  Check, Code, Share2, Plus, X, Search, Globe, Filter, MoreVertical, Trash2, Info, ChevronLeft, ChevronRight
} from 'lucide-react';
import { AppContext } from '../../../context/AppContext';
import { Movie } from '../../../types';
import { translations } from '../../../translations';
import { WEB_APP_URL } from '../../../constants';
import Modal from '../../common/Modal';

interface NetflixEntertainmentProps {
  guestMovieId?: string;
}

const NetflixEntertainment: React.FC<NetflixEntertainmentProps> = ({ guestMovieId }) => {
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
        if (!fetchSuccess) throw new Error("Failed to fetch page source.");
      } else {
        htmlContent = inputSource;
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
        throw new Error("No .m3u8 found in source.");
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
        } else {
            const error = await response.json();
            alert(`Error: ${error.message}`);
        }
    } catch (e) {
        console.error("Failed to add movie", e);
        alert("Failed to add movie to server");
    } finally {
        setIsSubmitting(false);
    }
  };

  const deleteMovie = async (id: string) => {
    if (confirm('Delete this movie?')) {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${WEB_APP_URL}/api/admin/movies/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.ok) {
                await refreshData();
                showNotification("ភាពយន្តត្រូវបានលុប", "info");
            } else {
                const error = await response.json();
                alert(`Error: ${error.message}`);
            }
        } catch (e) {
            console.error("Failed to delete movie", e);
            alert("Failed to delete movie from server");
        }
    }
  };

  const filteredMovies = movies.filter(m => {
    return m.Title.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const trendingMovies = filteredMovies.slice(0, 5);
  const shortFilms = filteredMovies.filter(m => m.Type === 'short');
  const longFilms = filteredMovies.filter(m => m.Type === 'long');
  const series = filteredMovies.filter(m => m.Type === 'series');

  useEffect(() => {
    if (activeMovie && iframeContainerRef.current) {
      const container = iframeContainerRef.current;
      container.innerHTML = '';
      const playerHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <script src="https://cdn.jsdelivr.net/npm/hls.js@1.5.7/dist/hls.min.js"></script>
          <style>
            body { margin: 0; background: #000; display: flex; align-items: center; justify-content: center; height: 100vh; overflow: hidden; }
            video { width: 100%; height: 100%; outline: none; background: #000; }
            #error-overlay { 
              position: absolute; top: 0; left: 0; width: 100%; height: 100%; 
              background: rgba(0,0,0,0.8); color: white; display: none; 
              flex-direction: column; align-items: center; justify-content: center; 
              font-family: sans-serif; text-align: center; padding: 20px;
            }
            button { 
              background: #e50914; color: white; border: none; padding: 10px 20px; 
              margin-top: 15px; border-radius: 4px; cursor: pointer; font-weight: bold;
            }
          </style>
        </head>
        <body>
          <video id="video" controls autoplay playsinline></video>
          <div id="error-overlay">
            <h3 id="error-msg">Video Load Failed</h3>
            <p>We are having trouble playing this stream. It might be blocked or expired.</p>
            <button onclick="retry()">Retry Playback</button>
          </div>
          <script>
            var video = document.getElementById('video');
            var errorOverlay = document.getElementById('error-overlay');
            var errorMsg = document.getElementById('error-msg');
            var videoSrc = '${activeMovie.VideoURL.replace(/'/g, "\\'")}';
            var hls = null;
            
            function retry() {
              errorOverlay.style.display = 'none';
              initHls(videoSrc);
            }

            function initHls(url) {
              if (hls) { hls.destroy(); }
              
              if (Hls.isSupported()) {
                hls = new Hls({
                  debug: false,
                  enableWorker: true,
                  lowLatencyMode: true,
                  backBufferLength: 90,
                  capLevelToPlayerSize: true,
                  autoStartLoad: true,
                  xhrSetup: function(xhr, url) {
                    xhr.withCredentials = false;
                  }
                });
                
                hls.loadSource(url);
                hls.attachMedia(video);
                
                hls.on(Hls.Events.ERROR, function (event, data) {
                  if (data.fatal) {
                    switch (data.type) {
                      case Hls.ErrorTypes.NETWORK_ERROR:
                        console.log("fatal network error encountered, try to recover");
                        if (!url.includes('allorigins')) {
                           console.log("Attempting proxy fallback...");
                           var proxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(videoSrc);
                           initHls(proxyUrl);
                        } else {
                           errorOverlay.style.display = 'flex';
                           errorMsg.innerText = "Network Error: Link may be broken or blocked.";
                        }
                        break;
                      case Hls.ErrorTypes.MEDIA_ERROR:
                        console.log("fatal media error encountered, try to recover");
                        hls.recoverMediaError();
                        break;
                      default:
                        hls.destroy();
                        errorOverlay.style.display = 'flex';
                        errorMsg.innerText = "Critical Error: " + data.details;
                        break;
                    }
                  }
                });
              } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                // For Safari/iOS native support
                video.src = url;
                video.addEventListener('error', function() {
                   if (!url.includes('allorigins')) {
                      initHls('https://api.allorigins.win/raw?url=' + encodeURIComponent(videoSrc));
                   } else {
                      errorOverlay.style.display = 'flex';
                   }
                });
              }
            }

            initHls(videoSrc);
          </script>
        </body>
        </html>
      `;
      const iframe = document.createElement('iframe');
      iframe.style.width = '100%';
      iframe.style.height = '100%';
      iframe.style.border = 'none';
      iframe.allowFullscreen = true;
      container.appendChild(iframe);
      const doc = iframe.contentWindow?.document;
      if (doc) { doc.open(); doc.write(playerHtml); doc.close(); }
    }
  }, [activeMovie]);

  const MovieRow = ({ title, items }: { title: string, items: Movie[] }) => {
    if (items.length === 0) return null;
    return (
      <div className="mb-8 group/row relative">
        <h3 className="text-xl font-bold mb-4 px-12 group-hover/row:text-red-600 transition-colors uppercase tracking-tight">{title}</h3>
        <div className="flex gap-2 overflow-x-auto px-12 pb-8 scrollbar-hide no-scrollbar scroll-smooth">
          {items.map(movie => (
            <div 
              key={movie.ID} 
              className="relative min-w-[200px] md:min-w-[240px] aspect-[2/3] group/card cursor-pointer transition-all duration-300 hover:scale-105 hover:z-10"
              onClick={() => setActiveMovie(movie)}
            >
              <img 
                src={movie.Thumbnail} 
                alt={movie.Title} 
                className="w-full h-full object-cover rounded-md shadow-lg"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 p-4 flex flex-col justify-end rounded-md">
                <h4 className="font-bold text-sm mb-1 line-clamp-2">{movie.Title}</h4>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] bg-red-600 px-1.5 py-0.5 rounded font-bold uppercase">{movie.Type}</span>
                  <span className="text-[10px] text-gray-300">{movie.Language}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button className="bg-white text-black p-2 rounded-full hover:bg-gray-200 transition-transform active:scale-90"><Play className="w-3 h-3 fill-current" /></button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); toggleMyList(movie.ID); }}
                    className={`p-2 rounded-full backdrop-blur-md transition-transform active:scale-90 ${myList.includes(movie.ID) ? 'bg-red-600 text-white' : 'bg-white/20 text-white hover:bg-white/30'}`}
                  >
                    {myList.includes(movie.ID) ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setShowDetails(movie); }}
                    className="bg-white/20 text-white p-2 rounded-full hover:bg-white/30 backdrop-blur-md transition-transform active:scale-90"
                  >
                    <Info className="w-3 h-3" />
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleShare(movie); }}
                    className="bg-white/20 text-white p-2 rounded-full hover:bg-white/30 backdrop-blur-md transition-transform active:scale-90"
                  >
                    <Share2 className="w-3 h-3" />
                  </button>
                  {isAdmin && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); deleteMovie(movie.ID); }}
                      className="bg-red-500/20 text-red-400 p-2 rounded-full hover:bg-red-500/40 ml-auto backdrop-blur-md transition-transform active:scale-90"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#080808] text-white font-['Kantumruy_Pro'] overflow-x-hidden">
      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.8s ease-out forwards; }
        .glass-header {
            background: rgba(8, 8, 8, 0.7);
            backdrop-filter: blur(20px) saturate(180%);
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }
      `}</style>

      {/* Header Redesign */}
      <nav 
        className={`fixed w-full z-[60] px-6 md:px-10 py-3 flex items-center justify-between transition-all duration-500 ${scrolled ? 'glass-header shadow-2xl' : 'bg-gradient-to-b from-black/90 to-transparent'}`}
        style={{ top: hasBanner ? (window.innerWidth < 768 ? '40px' : '44px') : '0' }}
      >
        <div className="flex items-center gap-4 md:gap-10">
          {/* Back Button */}
          <button 
            onClick={() => setAppState('role_selection')}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-all active:scale-90 group"
            title={t.back_to_role}
          >
            <ChevronLeft className="w-5 h-5 text-gray-400 group-hover:text-white" />
          </button>

          {/* New Logo / Title Area */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center shadow-lg shadow-red-600/20 rotate-3 group-hover:rotate-0 transition-transform">
                <Film className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
                <h1 className="text-lg md:text-xl font-black tracking-tighter uppercase italic leading-none">
                    O-<span className="text-red-600">ENTERTAINMENT</span>
                </h1>
                <span className="text-[8px] font-black text-white/30 uppercase tracking-[0.3em] mt-0.5">System Integrated Mini App</span>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-8 text-[11px] font-black uppercase tracking-widest text-white/40">
            {[
              { id: 'home', label: 'Home' },
              { id: 'tv', label: 'TV Shows' },
              { id: 'movies', label: 'Movies' },
              { id: 'mylist', label: 'My List' },
              { id: 'games', label: 'Games' }
            ].map(tab => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`transition-colors border-b-2 pb-1 mt-1 ${activeTab === tab.id ? 'text-white border-red-600' : 'hover:text-white border-transparent'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4 md:gap-6">
          <div className="relative flex items-center group">
            <div className="absolute right-full mr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <input 
                  type="text" 
                  placeholder={t.search} 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-black/40 border border-white/10 rounded-full px-4 py-1.5 text-xs w-40 md:w-56 outline-none focus:border-red-600 transition-all backdrop-blur-md"
                />
            </div>
            <Search className="w-5 h-5 cursor-pointer text-gray-400 hover:text-white transition-colors" />
          </div>
          
          {isAdmin && (
            <div className="flex items-center gap-2 border-l border-white/10 pl-4">
              <button 
                onClick={() => setShowAddModal(true)}
                className="bg-white/5 hover:bg-white/10 p-2.5 rounded-xl border border-white/5 transition-all active:scale-90"
              >
                <Plus className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setShowProxy(!showProxy)}
                className={`p-2.5 rounded-xl border transition-all active:scale-90 ${showProxy ? 'bg-red-600 border-red-500 shadow-lg shadow-red-600/40' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
                title={t.advanced_hls_proxy}
              >
                <Server className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Billboard */}
      {billboardMovie && (
        <div className="relative w-full h-[60vh] md:h-[85vh] overflow-hidden">
          <img 
            src={billboardMovie.Thumbnail} 
            alt={billboardMovie.Title}
            className="w-full h-full object-cover scale-105 animate-pulse-slow"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent flex flex-col justify-center px-6 md:px-12 pt-20">
            <div className="max-w-2xl animate-fade-in">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-red-600 font-black tracking-[0.3em] text-xs uppercase">O-ENTERTAINMENT</span>
              </div>
              <h2 className="text-4xl md:text-7xl font-black mb-4 tracking-tighter uppercase italic">{billboardMovie.Title}</h2>
              <p className="text-sm md:text-lg text-gray-200 mb-8 line-clamp-3 md:line-clamp-none font-medium leading-relaxed drop-shadow-md">
                {billboardMovie.Description}
              </p>
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setActiveMovie(billboardMovie)}
                  className="bg-white text-black px-6 md:px-10 py-2.5 md:py-3.5 rounded-md font-black flex items-center gap-3 hover:bg-gray-200 transition-all active:scale-95 shadow-xl"
                >
                  <Play className="w-5 h-5 fill-current md:w-6 md:h-6" /> Play
                </button>
                <button 
                  onClick={() => setShowDetails(billboardMovie)}
                  className="bg-gray-500/50 text-white px-6 md:px-10 py-2.5 md:py-3.5 rounded-md font-black flex items-center gap-3 hover:bg-gray-500/70 backdrop-blur-md transition-all active:scale-95 shadow-xl"
                >
                  <Info className="w-5 h-5 md:w-6 md:h-6" /> More Info
                </button>
              </div>
            </div>
          </div>
          <div className="absolute bottom-0 w-full h-32 bg-gradient-to-t from-[#080808] to-transparent"></div>
        </div>
      )}

      {/* Main Content Rows */}
      <main className="relative z-10 -mt-20 md:-mt-32 pb-20">
        {activeTab === 'home' && (
          <>
            {isAdmin && showProxy && (
              /* ... Proxy panel remains the same ... */
              <div className="mx-12 bg-black/80 border border-red-600/30 rounded-2xl p-8 mb-12 backdrop-blur-2xl animate-fade-in shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-black flex items-center gap-3 italic">
                    <Server className="w-8 h-8 text-red-600" />
                    {t.advanced_hls_proxy}
                    <span className="text-[10px] bg-red-600 px-3 py-1 rounded-full uppercase ml-4 tracking-widest font-black">Admin Access</span>
                  </h2>
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => refreshData()}
                      className="bg-white/5 hover:bg-white/10 text-white/60 hover:text-white px-4 py-2 rounded-xl border border-white/10 transition-all text-[10px] font-black uppercase tracking-widest"
                    >
                      Refresh Data
                    </button>
                    <button onClick={() => setShowProxy(false)} className="hover:text-red-600"><X className="w-6 h-6" /></button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <button 
                    onClick={() => setInputType('url')}
                    className={`p-4 rounded-xl border-2 transition-all font-black uppercase tracking-widest text-xs ${inputType === 'url' ? 'border-red-600 bg-red-600/10 text-red-600' : 'border-white/10 bg-white/5 hover:border-white/20'}`}
                  >
                    Direct URL
                  </button>
                  <button 
                    onClick={() => setInputType('source')}
                    className={`p-4 rounded-xl border-2 transition-all font-black uppercase tracking-widest text-xs ${inputType === 'source' ? 'border-red-600 bg-red-600/10 text-red-600' : 'border-white/10 bg-white/5 hover:border-white/20'}`}
                  >
                    HTML Source
                  </button>
                </div>
                {inputType === 'url' ? (
                  <input 
                    type="text" 
                    placeholder="Paste movie page link..." 
                    value={inputUrl}
                    onChange={(e) => setInputUrl(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-4 mb-6 outline-none focus:border-red-600 transition-colors font-medium"
                  />
                ) : (
                  <textarea 
                    placeholder="Paste HTML page source..." 
                    value={inputSource}
                    onChange={(e) => setInputSource(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-4 mb-6 outline-none focus:border-red-600 h-40 font-mono text-xs transition-colors"
                  />
                )}
                <button 
                  onClick={handleFetchVideo}
                  disabled={status === 'loading'}
                  className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-800 text-white font-black py-4 rounded-xl transition-all flex items-center justify-center gap-3 uppercase tracking-widest shadow-xl active:scale-[0.98]"
                >
                  {status === 'loading' ? <Loader2 className="w-6 h-6 animate-spin" /> : <Play className="w-6 h-6 fill-current" />}
                  Extract & Bypass Stream
                </button>
                {extractedM3u8 && (
                  <div className="mt-8 p-6 bg-green-500/5 border border-green-500/20 rounded-xl animate-fade-in">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-green-400 font-black flex items-center gap-3 text-sm uppercase"><CheckCircle2 className="w-5 h-5" /> Link Successfully Decrypted</span>
                      <button onClick={() => handleCopy(extractedM3u8)} className="text-white hover:text-green-400 bg-white/5 p-2 rounded-lg transition-colors"><Copy className="w-5 h-5" /></button>
                    </div>
                    <div className="text-xs break-all font-mono text-gray-500 bg-black/40 p-4 rounded-lg mb-6 leading-relaxed">{extractedM3u8}</div>
                    <button 
                      onClick={() => {
                        setNewMovie({ ...newMovie, VideoURL: extractedM3u8 });
                        setShowAddModal(true);
                      }}
                      className="w-full bg-green-600 hover:bg-green-700 text-white text-sm font-black py-3 rounded-xl uppercase tracking-widest transition-all shadow-xl active:scale-95"
                    >
                      Create Mini App Entry
                    </button>
                  </div>
                )}
                {status === 'error' && <div className="mt-6 text-red-400 text-sm flex items-center gap-3 bg-red-600/10 p-4 rounded-xl animate-shake"><AlertCircle className="w-5 h-5" /> {errorMessage}</div>}
              </div>
            )}
            <MovieRow title="Trending Now" items={trendingMovies} />
            <MovieRow title="Short Films" items={shortFilms} />
            <MovieRow title="Khmer Series" items={series} />
            <MovieRow title="Feature Movies" items={longFilms} />
          </>
        )}

        {activeTab === 'tv' && <MovieRow title="TV Shows & Series" items={series} />}
        {activeTab === 'movies' && <MovieRow title="Feature Movies" items={[...longFilms, ...shortFilms]} />}
        
        {activeTab === 'mylist' && (
          <MovieRow 
            title="My List" 
            items={movies.filter(m => myList.includes(m.ID))} 
          />
        )}

        {activeTab === 'games' && (
          <div className="px-12 py-10">
            <h3 className="text-2xl font-black mb-8 italic uppercase tracking-tighter">Mini <span className="text-red-600">Games</span></h3>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="aspect-video bg-white/5 rounded-xl border border-white/10 flex flex-col items-center justify-center group cursor-pointer hover:border-red-600/50 transition-all overflow-hidden relative">
                   <div className="absolute inset-0 bg-gradient-to-br from-red-600/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                   <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <Code className="w-8 h-8 text-white/40 group-hover:text-red-600" />
                   </div>
                   <h4 className="font-black uppercase tracking-widest text-xs text-white/60 group-hover:text-white">Game #{i}</h4>
                   <span className="text-[10px] text-white/20 mt-2">COMING SOON</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {filteredMovies.length === 0 && (
          <div className="text-center py-40 text-gray-600 animate-fade-in">
            <Film className="w-20 h-20 mx-auto mb-6 opacity-10" />
            <p className="text-xl font-black uppercase tracking-widest opacity-20">{t.no_data}</p>
          </div>
        )}
      </main>

      {/* Video Player Modal (Full Screen Premium) */}
      {activeMovie && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col animate-fade-in">
          <div 
            className="absolute w-full z-10 p-6 md:p-10 flex items-center justify-between bg-gradient-to-b from-black/90 to-transparent pointer-events-none"
            style={{ top: hasBanner ? (window.innerWidth < 768 ? '40px' : '44px') : '0' }}
          >
            <div className="flex items-center gap-6 pointer-events-auto">
              <button 
                onClick={() => {
                  setActiveMovie(null);
                  if (appState === 'watch') setAppState('entertainment');
                }} 
                className="text-white hover:text-gray-300 transition-all hover:scale-110 active:scale-90"
              >
                <X className="w-10 h-10 md:w-12 md:h-12" />
              </button>
              <div className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
                <h2 className="text-2xl md:text-4xl font-black tracking-tighter uppercase italic">{activeMovie.Title}</h2>
                <div className="flex items-center gap-3 mt-1">
                   <span className="text-[10px] bg-red-600 px-2 py-0.5 rounded font-black uppercase">{activeMovie.Type}</span>
                   <p className="text-xs md:text-sm text-gray-400 font-medium">{activeMovie.Language} • {activeMovie.Country}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4 pointer-events-auto">
               {isAdmin && (
                 <button 
                    onClick={() => handleCopy(activeMovie.VideoURL)} 
                    className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-4 md:px-6 py-2.5 md:py-3 rounded-full text-xs font-black uppercase tracking-widest backdrop-blur-xl border border-white/10 transition-all"
                 >
                   <Copy className="w-4 h-4" /> {t.copy_m3u8}
                 </button>
               )}
               <button 
                  onClick={() => handleShare(activeMovie)} 
                  className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-4 md:px-6 py-2.5 md:py-3 rounded-full text-xs font-black uppercase tracking-widest backdrop-blur-xl border border-white/10 transition-all"
               >
                 <Share2 className="w-4 h-4" /> {t.share_link}
               </button>
            </div>
          </div>
          <div className="flex-1 relative bg-black" ref={iframeContainerRef}>
            {/* HLS Player Injected Here */}
          </div>
          <div className="p-8 md:p-12 bg-[#141414] border-t border-white/5 relative z-10">
            <h3 className="text-lg font-black uppercase tracking-widest text-red-600 mb-4">About This Story</h3>
            <p className="text-sm md:text-base text-gray-300 max-w-4xl font-medium leading-relaxed">{activeMovie.Description}</p>
          </div>
        </div>
      )}

      {/* Movie Details Modal */}
      {showDetails && (
        <Modal 
          isOpen={!!showDetails} 
          onClose={() => setShowDetails(null)}
          maxWidth="max-w-4xl"
        >
          <div className="relative -m-6 overflow-hidden rounded-t-xl">
             <img src={showDetails.Thumbnail} className="w-full aspect-video object-cover" alt={showDetails.Title} />
             <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a1a] via-transparent to-transparent"></div>
             <button 
                onClick={() => setShowDetails(null)}
                className="absolute top-4 right-4 bg-black/50 p-2 rounded-full hover:bg-black/80 transition-colors"
             >
                <X className="w-6 h-6" />
             </button>
             <div className="absolute bottom-8 left-8 right-8">
                <h2 className="text-4xl font-black uppercase italic tracking-tighter mb-4">{showDetails.Title}</h2>
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => { setActiveMovie(showDetails); setShowDetails(null); }}
                    className="bg-white text-black px-8 py-3 rounded font-black flex items-center gap-2 hover:bg-gray-200 transition-all active:scale-95"
                  >
                    <Play className="w-5 h-5 fill-current" /> Play
                  </button>
                  <button 
                    onClick={() => toggleMyList(showDetails.ID)}
                    className="bg-white/10 hover:bg-white/20 p-3 rounded-full border border-white/10 transition-all"
                  >
                    {myList.includes(showDetails.ID) ? <Check className="w-5 h-5 text-red-600" /> : <Plus className="w-5 h-5" />}
                  </button>
                </div>
             </div>
          </div>
          <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-8 text-white bg-[#1a1a1a]">
             <div className="md:col-span-2 space-y-4">
                <div className="flex items-center gap-3 text-sm">
                   <span className="text-green-500 font-bold">98% Match</span>
                   <span className="border border-white/40 px-1.5 py-0.5 text-[10px] rounded">HD</span>
                   <span className="text-gray-400 font-medium">{new Date(showDetails.AddedAt).getFullYear()}</span>
                </div>
                <p className="text-lg leading-relaxed text-gray-200 font-medium">
                   {showDetails.Description}
                </p>
             </div>
             <div className="space-y-4 text-sm">
                <div>
                   <span className="text-gray-500">Category:</span>
                   <span className="ml-2 hover:underline cursor-pointer">{showDetails.Category}</span>
                </div>
                <div>
                   <span className="text-gray-500">Language:</span>
                   <span className="ml-2">{showDetails.Language}</span>
                </div>
                <div>
                   <span className="text-gray-500">Country:</span>
                   <span className="ml-2">{showDetails.Country}</span>
                </div>
                <div>
                   <span className="text-gray-500">Type:</span>
                   <span className="ml-2 uppercase">{showDetails.Type}</span>
                </div>
             </div>
          </div>
        </Modal>
      )}

      {/* Add Movie Modal (Premium Dark) */}
      {showAddModal && (
        <Modal 
          isOpen={showAddModal} 
          onClose={() => setShowAddModal(false)}
          title={t.add_movie}
        >
          <div className="space-y-6 text-white p-2">
            <div>
              <label className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em] mb-2 block">{t.title}</label>
              <input 
                type="text" 
                value={newMovie.Title || ''}
                onChange={(e) => setNewMovie({ ...newMovie, Title: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 outline-none focus:border-red-600 transition-colors font-medium"
                placeholder="Enter movie title"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em] mb-2 block">{t.m3u8_link}</label>
              <input 
                type="text" 
                value={newMovie.VideoURL || ''}
                onChange={(e) => setNewMovie({ ...newMovie, VideoURL: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 outline-none focus:border-red-600 transition-colors font-medium"
                placeholder="https://.../playlist.m3u8"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em] mb-2 block">{t.thumbnail_url}</label>
              <input 
                type="text" 
                value={newMovie.Thumbnail || ''}
                onChange={(e) => setNewMovie({ ...newMovie, Thumbnail: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 outline-none focus:border-red-600 transition-colors font-medium"
                placeholder="Image URL (Unsplash or direct)"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em] mb-2 block">{t.category_label}</label>
                <select 
                  value={newMovie.Type}
                  onChange={(e) => setNewMovie({ ...newMovie, Type: e.target.value as any })}
                  className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl p-3 outline-none focus:border-red-600 transition-colors font-black uppercase text-xs"
                >
                  <option value="short">{t.short_film}</option>
                  <option value="long">{t.long_film}</option>
                  <option value="series">{t.series}</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em] mb-2 block">{t.language_label}</label>
                <input 
                  type="text" 
                  value={newMovie.Language || ''}
                  onChange={(e) => setNewMovie({ ...newMovie, Language: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 outline-none focus:border-red-600 transition-colors font-medium"
                  placeholder="e.g. Khmer, English"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em] mb-2 block">{t.description_label}</label>
              <textarea 
                value={newMovie.Description || ''}
                onChange={(e) => setNewMovie({ ...newMovie, Description: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 outline-none focus:border-red-600 transition-colors font-medium h-24 resize-none"
                placeholder="What is this movie about?"
              />
            </div>
            <button 
              onClick={addMovieToStore}
              className="w-full bg-red-600 hover:bg-red-700 font-black py-4 rounded-xl mt-4 uppercase tracking-[0.2em] shadow-xl transition-all active:scale-95"
            >
              {t.save}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default NetflixEntertainment;
