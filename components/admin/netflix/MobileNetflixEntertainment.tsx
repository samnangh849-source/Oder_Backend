import React, { useState, useRef, useEffect, useContext, useMemo } from 'react';
import { 
  Play, Loader2, AlertCircle, CheckCircle2, Server, Film, Copy, 
  Check, Share2, Plus, X, Search, Info, ChevronLeft, Trash2
} from 'lucide-react';
import { AppContext } from '../../../context/AppContext';
import { Movie } from '../../../types';
import { translations } from '../../../translations';
import { WEB_APP_URL } from '../../../constants';
import Modal from '../../common/Modal';

interface MobileNetflixEntertainmentProps {
  guestMovieId?: string;
}

const MobileNetflixEntertainment: React.FC<MobileNetflixEntertainmentProps> = ({ guestMovieId }) => {
  const { currentUser, language, setAppState, originalAdminUser, appData, refreshData, showNotification } = useContext(AppContext);
  const t = translations[language];
  const isAdmin = currentUser?.IsSystemAdmin || (currentUser?.Role && currentUser.Role.toLowerCase() === 'admin');

  const [localMovies, setLocalMovies] = useState<Movie[]>([]);
  const movies = useMemo(() => (appData?.movies?.length ? appData.movies : localMovies), [appData?.movies, localMovies]);

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
            } catch (e) {}
        };
        fetchMovies();
    }
  }, [appData?.movies]);
  
  const [activeMovie, setActiveMovie] = useState<Movie | null>(null);
  const [billboardMovie, setBillboardMovie] = useState<Movie | null>(null);
  const [activeTab, setActiveTab] = useState<'home' | 'movies' | 'mylist'>('home');
  const [myList, setMyList] = useState<string[]>(() => {
    const saved = localStorage.getItem('entertainment_mylist');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

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

  // Modal for Adding Movie
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newMovie, setNewMovie] = useState<Partial<Movie>>({
    Type: 'long',
    Language: 'Khmer',
    Country: 'Cambodia'
  });

  useEffect(() => { localStorage.setItem('entertainment_mylist', JSON.stringify(myList)); }, [myList]);

  const toggleMyList = (id: string) => {
    setMyList(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
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

  // Categories & Filters
  const allCategories = Array.from(new Set(movies.map(m => m.Category).filter(Boolean)));
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filteredMovies = movies.filter(m => {
    const matchesSearch = m.Title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = activeTab === 'home' || 
                       (activeTab === 'movies' && m.Type === 'long') ||
                       (activeTab === 'mylist' && myList.includes(m.ID));
    return matchesSearch && matchesTab;
  });

  const finalFilteredMovies = selectedCategory 
    ? filteredMovies.filter(m => m.Category === selectedCategory)
    : filteredMovies;

  const trendingMovies = [...movies].sort((a, b) => new Date(b.AddedAt || 0).getTime() - new Date(a.AddedAt || 0).getTime()).slice(0, 5);
  const shortFilms = movies.filter(m => m.Type === 'short');
  const longFilms = movies.filter(m => m.Type === 'long');
  const series = movies.filter(m => m.Type === 'series');

  // Continue Watching
  const continueWatchingMovies = movies.filter(m => {
    const prog = watchProgress[m.ID];
    return prog && prog.time > 10 && prog.time < prog.duration - 30;
  });

  // Hero Slider Logic
  const heroMovies = trendingMovies.length > 0 ? trendingMovies : movies.slice(0, 5);
  const [heroIndex, setHeroIndex] = useState(0);

  useEffect(() => {
    if (activeTab === 'home' && !activeMovie && heroMovies.length > 0 && !searchQuery) {
      const interval = setInterval(() => {
        setHeroIndex(prev => (prev + 1) % heroMovies.length);
      }, 8000);
      return () => clearInterval(interval);
    }
  }, [activeTab, activeMovie, heroMovies.length, searchQuery]);

  useEffect(() => {
    if (heroMovies.length > 0) {
      setBillboardMovie(heroMovies[heroIndex]);
    }
  }, [heroIndex, heroMovies]);

  useEffect(() => {
    if (guestMovieId && movies.length > 0) {
      const movie = movies.find(m => m.ID === guestMovieId);
      if (movie) setActiveMovie(movie);
    }
  }, [guestMovieId, movies]);

  const iframeContainerRef = useRef<HTMLDivElement>(null);

  const handleShare = (movie: Movie) => {
    const shareUrl = `${window.location.origin}${window.location.pathname}?view=watch&movie=${movie.ID}`;
    navigator.clipboard.writeText(shareUrl);
    showNotification("Link copied to clipboard!", "success");
  };

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
                    settings: ['quality', 'speed'],
                    quality: { default: 720, options: [1080, 720, 480, 360] }
                  });
                  
                  player.on('ready', () => {
                     if (${startTime} > 0) player.currentTime = ${startTime};
                  });

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
                    };
                    initPlayer();
                  });
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
      <div className="mb-6 px-4">
        <h3 className="text-sm font-bold mb-3 uppercase tracking-wider opacity-60">{title}</h3>
        <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar">
          {items.map(movie => {
            const progress = watchProgress[movie.ID];
            const progressPercent = progress ? (progress.time / progress.duration) * 100 : 0;
            return (
              <div key={movie.ID} className="relative min-w-[120px] aspect-[2/3] cursor-pointer" onClick={() => setActiveMovie(movie)}>
                <img src={movie.Thumbnail} alt={movie.Title} className="w-full h-full object-cover rounded-md shadow-lg" />
                
                {progressPercent > 0 && progressPercent < 95 && (
                  <div className="absolute bottom-0 left-0 w-full h-1 bg-gray-700/50 rounded-b-md overflow-hidden">
                    <div className="h-full bg-red-600" style={{ width: `${progressPercent}%` }}></div>
                  </div>
                )}

                <div className="absolute top-1 right-1 flex flex-col gap-1">
                   <button onClick={(e) => { e.stopPropagation(); toggleMyList(movie.ID); }} className="p-1.5 bg-black/40 backdrop-blur-md rounded-full">
                      {myList.includes(movie.ID) ? <Check className="w-3.5 h-3.5 text-red-600" /> : <Plus className="w-3.5 h-3.5 text-white" />}
                   </button>
                   {isAdmin && (
                      <button onClick={(e) => { e.stopPropagation(); deleteMovie(movie.ID); }} className="p-1.5 bg-red-600/40 backdrop-blur-md rounded-full">
                        <Trash2 className="w-3.5 h-3.5 text-white" />
                      </button>
                   )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#080808] text-white font-['Kantumruy_Pro'] pb-20">
      <nav className="sticky top-0 z-[60] px-4 py-3 bg-black/60 backdrop-blur-xl flex items-center justify-between">
        <div className="flex items-center gap-3">
           <button onClick={() => setAppState('role_selection')} className="p-1.5 bg-white/5 rounded-full"><ChevronLeft className="w-5 h-5" /></button>
           {!showSearch && <h1 className="text-lg font-black italic">O-<span className="text-red-600">ENT</span></h1>}
        </div>
        <div className="flex gap-3 items-center flex-1 justify-end">
           {showSearch && (
             <input autoFocus type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search..." className="flex-1 bg-white/10 border border-white/20 rounded-full py-1.5 px-3 text-xs outline-none focus:border-red-500" />
           )}
           <button onClick={() => setShowSearch(!showSearch)} className="p-1.5"><Search className="w-5 h-5 opacity-40" /></button>
           {isAdmin && (
              <button onClick={() => setShowAddModal(true)} className="p-1.5 bg-white/10 rounded-full border border-white/20">
                <Plus className="w-5 h-5" />
              </button>
           )}
           {!showSearch && (
             <div className="w-7 h-7 rounded-full bg-red-600 flex items-center justify-center text-[10px] font-bold">
                {currentUser?.UserName?.substring(0, 1).toUpperCase()}
             </div>
           )}
        </div>
      </nav>

      {!searchQuery && (
        <div className="flex gap-6 px-4 py-4 text-xs font-bold uppercase opacity-60 overflow-x-auto no-scrollbar">
           <button onClick={() => {setActiveTab('home'); setSelectedCategory(null);}} className={`whitespace-nowrap ${activeTab === 'home' ? 'text-white border-b-2 border-red-600 pb-1 opacity-100' : ''}`}>Home</button>
           <button onClick={() => {setActiveTab('movies'); setSelectedCategory(null);}} className={`whitespace-nowrap ${activeTab === 'movies' ? 'text-white border-b-2 border-red-600 pb-1 opacity-100' : ''}`}>Movies</button>
           <button onClick={() => {setActiveTab('mylist'); setSelectedCategory(null);}} className={`whitespace-nowrap ${activeTab === 'mylist' ? 'text-white border-b-2 border-red-600 pb-1 opacity-100' : ''}`}>My List</button>
        </div>
      )}

      {/* Categories filter */}
      {allCategories.length > 0 && !searchQuery && activeTab !== 'mylist' && (
        <div className="px-4 mb-4 flex gap-2 overflow-x-auto no-scrollbar">
          <button onClick={() => setSelectedCategory(null)} className={`whitespace-nowrap px-3 py-1 rounded-full text-[10px] font-bold border transition-colors ${!selectedCategory ? 'bg-white text-black border-white' : 'border-white/20 text-white/60'}`}>All</button>
          {allCategories.map(cat => (
            <button key={cat} onClick={() => setSelectedCategory(cat as string)} className={`whitespace-nowrap px-3 py-1 rounded-full text-[10px] font-bold border transition-colors ${selectedCategory === cat ? 'bg-white text-black border-white' : 'border-white/20 text-white/60'}`}>{cat}</button>
          ))}
        </div>
      )}

      {billboardMovie && activeTab === 'home' && !searchQuery && !selectedCategory && (
        <div className="relative w-full aspect-[4/5] mb-6 animate-[fade-in_1s_ease-out]" onClick={() => setActiveMovie(billboardMovie)}>
           <img key={billboardMovie.ID} src={billboardMovie.Thumbnail} className="w-full h-full object-cover animate-[fade-in_1s_ease-out]" />
           <div className="absolute inset-0 bg-gradient-to-t from-[#080808] via-black/40 to-transparent flex flex-col justify-end p-6 items-center text-center">
              <h2 className="text-4xl font-black italic uppercase mb-2 drop-shadow-lg">{billboardMovie.Title}</h2>
              <div className="flex gap-2 text-[10px] text-gray-300 font-bold mb-4">
                <span className="text-green-400">Match</span>
                {billboardMovie.Category && <span>• {billboardMovie.Category}</span>}
              </div>
              <div className="flex gap-3 w-full justify-center">
                 <button className="bg-white text-black px-6 py-2 rounded-sm font-bold text-sm flex items-center gap-2 flex-1 justify-center"><Play className="w-4 h-4 fill-current" /> Play</button>
                 <button onClick={(e) => { e.stopPropagation(); toggleMyList(billboardMovie.ID); }} className="bg-white/20 px-4 py-2 rounded-sm font-bold text-sm flex items-center gap-2 backdrop-blur-md border border-white/10 flex-1 justify-center">
                   {myList.includes(billboardMovie.ID) ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />} List
                 </button>
              </div>
           </div>
        </div>
      )}

      <main>
         {searchQuery && <MovieRow title="Search Results" items={filteredMovies} />}
         
         {!searchQuery && continueWatchingMovies.length > 0 && activeTab === 'home' && !selectedCategory && (
           <MovieRow title="Continue Watching" items={continueWatchingMovies} />
         )}

         {!searchQuery && (
           <MovieRow title={selectedCategory ? `${selectedCategory}` : "Trending"} items={selectedCategory ? finalFilteredMovies : trendingMovies} />
         )}

         {!searchQuery && !selectedCategory && (
           <>
             <MovieRow title="Recently Added" items={movies.slice().reverse().slice(0, 6)} />
             <MovieRow title="All Movies" items={longFilms} />
             <MovieRow title="Series" items={series} />
           </>
         )}
      </main>

      {activeMovie && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col animate-[fade-in_0.2s_ease-out]">
           <div className="p-4 flex items-center justify-between bg-gradient-to-b from-black to-transparent absolute top-0 w-full z-10">
              <button onClick={() => setActiveMovie(null)} className="p-2 bg-black/50 backdrop-blur rounded-full"><X className="w-6 h-6" /></button>
              <Share2 className="w-6 h-6 drop-shadow-md" onClick={() => handleShare(activeMovie)} />
           </div>
           <div className="w-full aspect-video mt-16" ref={iframeContainerRef}></div>
           <div className="p-5 flex-1 overflow-y-auto pb-10">
              <h2 className="text-2xl font-black italic mb-2">{activeMovie.Title}</h2>
              <div className="flex gap-3 text-[10px] text-gray-400 font-bold mb-4">
                 <span>{activeMovie.AddedAt ? new Date(activeMovie.AddedAt).getFullYear() : '2024'}</span>
                 {activeMovie.Category && <span>{activeMovie.Category}</span>}
              </div>
              <p className="opacity-70 leading-relaxed font-light text-sm mb-6">{activeMovie.Description || "No description available."}</p>
              
              <h3 className="text-sm font-bold mb-3 uppercase opacity-50 border-t border-white/10 pt-4">More Like This</h3>
              <div className="grid grid-cols-3 gap-2">
                {movies.filter(m => m.ID !== activeMovie.ID && (m.Category === activeMovie.Category || m.Type === activeMovie.Type)).slice(0, 6).map(movie => (
                  <div key={movie.ID} className="aspect-[2/3] cursor-pointer" onClick={() => setActiveMovie(movie)}>
                    <img src={movie.Thumbnail} className="w-full h-full object-cover rounded" />
                  </div>
                ))}
              </div>
           </div>
        </div>
      )}

      {showAddModal && (
        <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title={t.add_movie}>
          <div className="space-y-4 text-white p-2 max-h-[70vh] overflow-y-auto no-scrollbar">
            <div className="space-y-4">
              <div className="relative">
                <label className="text-[10px] text-gray-500 font-bold uppercase mb-1 block">{t.title}</label>
                <div className="flex gap-2">
                  <input type="text" value={newMovie.Title || ''} onChange={(e) => setNewMovie({ ...newMovie, Title: e.target.value })} className="flex-1 bg-white/5 border border-white/10 rounded-xl p-3 outline-none focus:border-red-600 transition-colors" placeholder="Movie Title" />
                  <button 
                    onClick={async () => {
                      if(!newMovie.Title) return;
                      setIsSubmitting(true);
                      try {
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
                           showNotification("No data found.", "warning");
                        }
                      } catch(e) { showNotification("Smart Fetch failed.", "error"); }
                      setIsSubmitting(false);
                    }}
                    className="bg-blue-600 px-3 rounded-xl flex items-center justify-center transition-colors disabled:opacity-50"
                    disabled={!newMovie.Title || isSubmitting}
                  >
                    <Search className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              <div>
                <label className="text-[10px] text-gray-500 font-bold uppercase mb-1 block">Description</label>
                <textarea value={newMovie.Description || ''} onChange={(e) => setNewMovie({ ...newMovie, Description: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 outline-none focus:border-red-600 h-24 resize-none" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-gray-500 font-bold uppercase mb-1 block">Type</label>
                  <select value={newMovie.Type || 'long'} onChange={(e) => setNewMovie({ ...newMovie, Type: e.target.value as any })} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 outline-none focus:border-red-600 appearance-none">
                    <option value="long" className="bg-[#1a1a1a]">Movie</option>
                    <option value="short" className="bg-[#1a1a1a]">Short</option>
                    <option value="series" className="bg-[#1a1a1a]">Series</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 font-bold uppercase mb-1 block">Category</label>
                  <input type="text" value={newMovie.Category || ''} onChange={(e) => setNewMovie({ ...newMovie, Category: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 outline-none focus:border-red-600" placeholder="Genre" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-gray-500 font-bold uppercase mb-1 block">Language</label>
                  <input type="text" value={newMovie.Language || 'Khmer'} onChange={(e) => setNewMovie({ ...newMovie, Language: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 outline-none focus:border-red-600" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 font-bold uppercase mb-1 block">Country</label>
                  <input type="text" value={newMovie.Country || 'Cambodia'} onChange={(e) => setNewMovie({ ...newMovie, Country: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 outline-none focus:border-red-600" />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-gray-500 font-bold uppercase mb-1 block">{t.m3u8_link}</label>
                <input type="text" value={newMovie.VideoURL || ''} onChange={(e) => setNewMovie({ ...newMovie, VideoURL: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 outline-none focus:border-red-600" />
              </div>
              
              <div>
                <label className="text-[10px] text-gray-500 font-bold uppercase mb-1 block">{t.thumbnail_url}</label>
                <input type="text" value={newMovie.Thumbnail || ''} onChange={(e) => setNewMovie({ ...newMovie, Thumbnail: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 outline-none focus:border-red-600" />
              </div>
            </div>

            <div className="pt-4 pb-2">
              <button 
                onClick={addMovieToStore} 
                disabled={isSubmitting}
                className="w-full bg-red-600 font-black py-4 rounded-xl shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all"
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

export default MobileNetflixEntertainment;