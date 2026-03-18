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

import MoviePlayer from './MoviePlayer';
import SeriesPlayerView from './SeriesPlayerView';

import { fileToBase64, convertGoogleDriveUrl } from '../../../utils/fileUtils';
import { compressImage } from '../../../utils/imageCompressor';

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

  const saveProgress = (id: string, time: number, duration: number) => {
    setWatchProgress(prev => {
      const updated = {
        ...prev,
        [id]: { time, duration }
      };
      localStorage.setItem('movie_progress', JSON.stringify(updated));
      return updated;
    });
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'movie_progress' && event.data?.id) {
        saveProgress(event.data.id, event.data.time, event.data.duration);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Modal for Adding Movie
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (file: File) => {
    if (!file) return;
    setIsUploading(true);
    try {
      const compressedBlob = await compressImage(file, 'balanced');
      const base64Data = await fileToBase64(compressedBlob);
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${WEB_APP_URL}/api/upload-image`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ 
          fileData: base64Data, 
          fileName: file.name, 
          mimeType: compressedBlob.type,
          sheetName: 'Movies'
        })
      });
      const result = await response.json();
      if (!response.ok || result.status !== 'success') throw new Error(result.message || 'Upload failed');
      
      const finalUrl = result.url || result.tempUrl;
      setNewMovie(prev => ({ ...prev, Thumbnail: finalUrl }));
      showNotification("Image uploaded successfully!", "success");
    } catch (err: any) { 
      showNotification(err.message, "error"); 
    } finally { 
      setIsUploading(false); 
    }
  };
  const [newMovie, setNewMovie] = useState<Partial<Movie>>({
    Type: 'long',
    Language: 'Khmer',
    Country: 'Cambodia'
  });

  // Admin HLS Proxy State
  const [showProxy, setShowProxy] = useState(false);
  const [inputUrl, setInputUrl] = useState('');
  const [inputType, setInputType] = useState<'url' | 'source'>('url');
  const [inputSource, setInputSource] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [extractedM3u8, setExtractedM3u8] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [episodes, setEpisodes] = useState<{title: string, url: string}[]>([]);

  useEffect(() => {
    if (newMovie.Type === 'series' && episodes.length === 0) {
      setEpisodes([{ title: `${newMovie.Title || 'Series'} - Ep 1`, url: '' }]);
    }
  }, [newMovie.Type]);

  const handleAddEpisode = () => {
    setEpisodes(prev => [...prev, { title: `${newMovie.Title || 'Series'} - Ep ${prev.length + 1}`, url: '' }]);
  };

  const handleRemoveEpisode = (index: number) => {
    setEpisodes(prev => prev.filter((_, i) => i !== index));
  };

  const handleEpisodeChange = (index: number, field: 'title' | 'url', value: string) => {
    setEpisodes(prev => prev.map((ep, i) => i === index ? { ...ep, [field]: value } : ep));
  };

  const handleFetchVideo = async () => {
    setStatus('loading');
    setExtractedM3u8(null);
    setErrorMessage(null);

    try {
      let htmlContent = '';
      if (inputType === 'url') {
        const targetUrl = inputUrl;
        const proxies = [
          `${WEB_APP_URL}/api/fetch-json?url=${encodeURIComponent(targetUrl)}`,
          `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`,
          `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`
        ];

        let fetchSuccess = false;
        for (const proxyUrl of proxies) {
          try {
            const response = await fetch(proxyUrl);
            if (!response.ok) continue;
            
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
              const data = await response.json();
              htmlContent = data.contents;
            } else {
              htmlContent = await response.text();
            }
            
            if (htmlContent) { fetchSuccess = true; break; }
          } catch (e) { console.warn(e); }
        }
        if (!fetchSuccess) throw new Error("មិនអាចទាញយកបានទេ។ អាចមកពី Network របស់អ្នកមានបញ្ហា។");
      } else {
        htmlContent = inputSource;
        if (!htmlContent.trim()) throw new Error("សូមបញ្ចូលកូដដើម (Page Source) ជាមុនសិន។");
      }

      // Check for iframes or direct m3u8 using the backend extractor
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, "text/html");
      const iframes = doc.querySelectorAll('.movieplay iframe, iframe, .embed-container iframe');
      
      let src = '';
      if (iframes.length > 0) {
        for (let i = 0; i < iframes.length; i++) {
          const iframeSrc = (iframes[i] as HTMLIFrameElement).src;
          if (iframeSrc && !iframeSrc.includes('googletagmanager') && !iframeSrc.includes('facebook')) {
            src = iframeSrc;
            break;
          }
        }
      }

      const targetExtractionUrl = src || (inputType === 'url' ? inputUrl : '');
      if (targetExtractionUrl) {
          const extractRes = await fetch(`${WEB_APP_URL}/api/extract-m3u8?url=${encodeURIComponent(targetExtractionUrl)}`);
          if (extractRes.ok) {
            const data = await extractRes.json();
            if (data.m3u8Url) {
              setExtractedM3u8(data.m3u8Url);
              setStatus('success');
              return;
            }
          }
          if (src) {
            setExtractedM3u8(src);
            setStatus('success');
            return;
          }
      }

      // Direct m3u8 search
      const m3u8Matches = [...htmlContent.matchAll(/(https?:\/\/[^\s"'<>]+?(\.m3u8|\.mp4|\/hlsplaylist\/|\/hls\/)[^\s"'<>]*)/gi)];
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

  useEffect(() => { localStorage.setItem('entertainment_mylist', JSON.stringify(myList)); }, [myList]);

  const toggleMyList = (id: string) => {
    setMyList(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  const addMovieToStore = async () => {
    if (!newMovie.Title) return;
    setIsSubmitting(true);
    try {
        const token = localStorage.getItem('token');
        
        if (newMovie.Type === 'series') {
          const validEpisodes = episodes.filter(ep => ep.title && ep.url);
          if (validEpisodes.length === 0) {
            showNotification("Please add at least one episode", "error");
            setIsSubmitting(false);
            return;
          }

          for (const ep of validEpisodes) {
            const payload = { ...newMovie, Title: ep.title, VideoURL: ep.url };
            await fetch(`${WEB_APP_URL}/api/admin/movies`, {
                method: 'POST',
                headers: { 
                  'Content-Type': 'application/json',
                  ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify(payload)
            });
          }
          showNotification("Episodes added successfully", "success");
        } else {
          if (!newMovie.VideoURL) {
            showNotification("Please enter Video URL", "error");
            setIsSubmitting(false);
            return;
          }
          const response = await fetch(`${WEB_APP_URL}/api/admin/movies`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
              },
              body: JSON.stringify(newMovie)
          });
          if (response.ok) showNotification("Movie added successfully", "success");
        }
        
        await refreshData();
        setShowAddModal(false);
        setNewMovie({ Type: 'long', Language: 'Khmer', Country: 'Cambodia' });
        setEpisodes([]);
    } catch (e) { 
      console.error(e); 
      showNotification("Failed to add movies", "error");
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
                headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
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


  const handleShare = (movie: Movie) => {
    const shareUrl = `${window.location.origin}${window.location.pathname}?view=watch&movie=${movie.ID}`;
    navigator.clipboard.writeText(shareUrl);
    showNotification("Link copied! Guests can watch this movie without login.", "success");
  };

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
             <input autoFocus type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={t.search_placeholder || "Search..."} className="flex-1 bg-white/10 border border-white/20 rounded-full py-1.5 px-3 text-xs outline-none focus:border-red-500" />
           )}
           <button onClick={() => setShowSearch(!showSearch)} className="p-1.5"><Search className="w-5 h-5 opacity-40" /></button>
           {isAdmin && (
              <>
                <button onClick={() => setShowProxy(!showProxy)} className={`p-1.5 rounded-full border transition-colors ${showProxy ? 'bg-red-600 border-red-500' : 'bg-white/10 border-white/20'}`}>
                  <Server className="w-5 h-5" />
                </button>
                <button onClick={() => setShowAddModal(true)} className="p-1.5 bg-white/10 rounded-full border border-white/20">
                  <Plus className="w-5 h-5" />
                </button>
              </>
           )}
           {!showSearch && (
             <div className="w-7 h-7 rounded-full bg-red-600 flex items-center justify-center text-[10px] font-bold">
                {currentUser?.UserName?.substring(0, 1).toUpperCase()}
             </div>
           )}
        </div>
      </nav>

      {showProxy && isAdmin && (
          <div className="m-4 bg-black/80 border border-red-600/30 rounded-2xl p-6 backdrop-blur-xl animate-[fade-in_0.3s_ease-out]">
            <h2 className="text-xl font-black mb-4 flex items-center gap-3 italic"><Server className="w-6 h-6 text-red-600" /> HLS Proxy</h2>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button onClick={() => setInputType('url')} className={`p-3 rounded-xl border-2 transition-all font-black text-[10px] uppercase ${inputType === 'url' ? 'border-red-600 bg-red-600/10 text-red-600' : 'border-white/10'}`}>Direct URL</button>
              <button onClick={() => setInputType('source')} className={`p-3 rounded-xl border-2 transition-all font-black text-[10px] uppercase ${inputType === 'source' ? 'border-red-600 bg-red-600/10 text-red-600' : 'border-white/10'}`}>HTML Source</button>
            </div>
            {inputType === 'url' ? (
              <input type="text" value={inputUrl} onChange={(e) => setInputUrl(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 mb-4 outline-none focus:border-red-600 text-xs" placeholder="Paste link..." />
            ) : (
              <textarea value={inputSource} onChange={(e) => setInputSource(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 mb-4 outline-none focus:border-red-600 h-32 font-mono text-[10px]" placeholder="Paste HTML..." />
            )}
            <button onClick={handleFetchVideo} disabled={status === 'loading'} className="w-full bg-red-600 font-black py-3 rounded-xl transition-all shadow-xl active:scale-[0.98] text-xs uppercase tracking-widest">
              {status === 'loading' ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Extract & Bypass'}
            </button>
            {extractedM3u8 && (
              <div className="mt-6 p-4 bg-green-500/5 border border-green-500/20 rounded-xl">
                <div className="flex justify-between mb-2 text-green-400 font-black text-[10px] uppercase tracking-widest">
                   <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Decrypted</span>
                   <button onClick={() => { navigator.clipboard.writeText(extractedM3u8); showNotification("Copied!", "success"); }}><Copy className="w-4 h-4" /></button>
                </div>
                <div className="text-[9px] break-all font-mono text-gray-500 bg-black/40 p-3 rounded-lg mb-4 line-clamp-2">{extractedM3u8}</div>
                <button onClick={() => { setNewMovie({ ...newMovie, VideoURL: extractedM3u8 }); setShowAddModal(true); setShowProxy(false); }} className="w-full bg-green-600 text-white font-black py-3 rounded-xl uppercase tracking-widest text-[10px]">Create Entry</button>
              </div>
            )}
            {status === 'error' && <div className="mt-4 text-red-400 text-[10px] flex items-center gap-3 bg-red-600/10 p-3 rounded-xl"><AlertCircle className="w-4 h-4" /> {errorMessage}</div>}
          </div>
      )}

      {!searchQuery && (
        <div className="flex gap-6 px-4 py-4 text-xs font-bold uppercase opacity-60 overflow-x-auto no-scrollbar">
           <button onClick={() => {setActiveTab('home'); setSelectedCategory(null);}} className={`whitespace-nowrap ${activeTab === 'home' ? 'text-white border-b-2 border-red-600 pb-1 opacity-100' : ''}`}>{t.today || 'Home'}</button>
           <button onClick={() => {setActiveTab('movies'); setSelectedCategory(null);}} className={`whitespace-nowrap ${activeTab === 'movies' ? 'text-white border-b-2 border-red-600 pb-1 opacity-100' : ''}`}>{t.movies || 'Movies'}</button>
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
        activeMovie.Type === 'series' ? (
          <SeriesPlayerView 
            movie={activeMovie}
            allMovies={movies}
            onBack={() => setActiveMovie(null)}
            onSelectMovie={setActiveMovie}
          />
        ) : (
          <MoviePlayer 
            movie={activeMovie}
            isMobile={true}
            onClose={() => setActiveMovie(null)}
            onShare={handleShare}
            watchProgress={watchProgress}
            onSaveProgress={saveProgress}
            relatedMovies={movies.filter(m => m.ID !== activeMovie.ID && (m.Category === activeMovie.Category || m.Type === activeMovie.Type)).slice(0, 6)}
            onSelectMovie={setActiveMovie}
          />
        )
      )}

      {showAddModal && (
        <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)}>
          <div className="flex flex-col h-full bg-[#141414] text-white">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10 sticky top-0 bg-[#141414] z-10">
              <h2 className="text-lg font-black italic uppercase tracking-wider">
                {t.add_movie || "Add New Movie"}
              </h2>
              <button 
                onClick={() => setShowAddModal(false)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-6 p-5 overflow-y-auto no-scrollbar">
              <div>
                <label className="text-[11px] text-gray-400 font-black uppercase mb-2 block tracking-widest">{t.title}</label>
                <div className="flex gap-3">
                  <input 
                    type="text" 
                    value={newMovie.Title || ''} 
                    onChange={(e) => setNewMovie({ ...newMovie, Title: e.target.value })} 
                    className="flex-1 bg-white/[0.03] border border-white/10 rounded-xl p-4 outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600/30 transition-all text-sm" 
                    placeholder="Movie Title" 
                  />
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
                    className="bg-gradient-to-br from-blue-600 to-indigo-700 px-4 rounded-xl flex items-center justify-center active:scale-95 transition-all disabled:opacity-50"
                    disabled={!newMovie.Title || isSubmitting}
                  >
                    <Search className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              <div>
                <label className="text-[11px] text-gray-400 font-black uppercase mb-2 block tracking-widest">Description</label>
                <textarea 
                  value={newMovie.Description || ''} 
                  onChange={(e) => setNewMovie({ ...newMovie, Description: e.target.value })} 
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl p-4 outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600/30 transition-all h-28 resize-none text-sm" 
                  placeholder="Movie description..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] text-gray-400 font-black uppercase mb-2 block tracking-widest">Type</label>
                  <div className="relative">
                    <select 
                      value={newMovie.Type || 'long'} 
                      onChange={(e) => setNewMovie({ ...newMovie, Type: e.target.value as any })} 
                      className="w-full bg-white/[0.03] border border-white/10 rounded-xl p-4 outline-none focus:border-red-600 appearance-none text-sm"
                    >
                      <option value="long" className="bg-[#1a1a1a]">Movie</option>
                      <option value="short" className="bg-[#1a1a1a]">Short</option>
                      <option value="series" className="bg-[#1a1a1a]">Series</option>
                    </select>
                    <ChevronLeft className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 -rotate-90 pointer-events-none opacity-50" />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] text-gray-400 font-black uppercase mb-2 block tracking-widest">Category</label>
                  <div className="relative">
                    <select 
                      value={['Action', 'Comedy', 'Drama', 'Horror', 'Sci-Fi', 'Romance', 'Animation', 'Documentary', 'Adventure', 'Fantasy', 'Mystery', 'Thriller'].includes(newMovie.Category || '') ? newMovie.Category : 'Other'} 
                      onChange={(e) => {
                        if (e.target.value !== 'Other') {
                          setNewMovie({ ...newMovie, Category: e.target.value });
                        } else {
                          setNewMovie({ ...newMovie, Category: '' });
                        }
                      }} 
                      className="w-full bg-white/[0.03] border border-white/10 rounded-xl p-4 outline-none focus:border-red-600 appearance-none text-sm"
                    >
                      <option value="Action" className="bg-[#1a1a1a]">Action</option>
                      <option value="Adventure" className="bg-[#1a1a1a]">Adventure</option>
                      <option value="Animation" className="bg-[#1a1a1a]">Animation</option>
                      <option value="Comedy" className="bg-[#1a1a1a]">Comedy</option>
                      <option value="Documentary" className="bg-[#1a1a1a]">Documentary</option>
                      <option value="Drama" className="bg-[#1a1a1a]">Drama</option>
                      <option value="Fantasy" className="bg-[#1a1a1a]">Fantasy</option>
                      <option value="Horror" className="bg-[#1a1a1a]">Horror</option>
                      <option value="Mystery" className="bg-[#1a1a1a]">Mystery</option>
                      <option value="Romance" className="bg-[#1a1a1a]">Romance</option>
                      <option value="Sci-Fi" className="bg-[#1a1a1a]">Sci-Fi</option>
                      <option value="Thriller" className="bg-[#1a1a1a]">Thriller</option>
                      <option value="Other" className="bg-[#1a1a1a]">Other</option>
                    </select>
                    <ChevronLeft className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 -rotate-90 pointer-events-none opacity-50" />
                  </div>
                </div>
              </div>

              {!['Action', 'Adventure', 'Animation', 'Comedy', 'Documentary', 'Drama', 'Fantasy', 'Horror', 'Mystery', 'Romance', 'Sci-Fi', 'Thriller'].includes(newMovie.Category || '') && (
                <input 
                  type="text" 
                  value={newMovie.Category || ''} 
                  onChange={(e) => setNewMovie({ ...newMovie, Category: e.target.value })} 
                  className="w-full bg-white/[0.05] border border-red-600/30 rounded-xl p-4 outline-none focus:border-red-600 transition-all text-sm" 
                  placeholder="Enter custom category..." 
                />
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] text-gray-400 font-black uppercase mb-2 block tracking-widest">Language</label>
                  <input type="text" value={newMovie.Language || 'Khmer'} onChange={(e) => setNewMovie({ ...newMovie, Language: e.target.value })} className="w-full bg-white/[0.03] border border-white/10 rounded-xl p-4 outline-none focus:border-red-600 text-sm" />
                </div>
                <div>
                  <label className="text-[11px] text-gray-400 font-black uppercase mb-2 block tracking-widest">Country</label>
                  <input type="text" value={newMovie.Country || 'Cambodia'} onChange={(e) => setNewMovie({ ...newMovie, Country: e.target.value })} className="w-full bg-white/[0.03] border border-white/10 rounded-xl p-4 outline-none focus:border-red-600 text-sm" />
                </div>
              </div>

              <div>
                <label className="text-[11px] text-gray-400 font-black uppercase mb-2 block tracking-widest">Video URL / Episodes</label>
                {newMovie.Type === 'series' ? (
                  <div className="space-y-3">
                    <div className="max-h-60 overflow-y-auto space-y-2 no-scrollbar">
                      {episodes.map((ep, idx) => (
                        <div key={idx} className="flex gap-2">
                          <input 
                            type="text" 
                            value={ep.title} 
                            onChange={(e) => handleEpisodeChange(idx, 'title', e.target.value)}
                            className="w-1/3 bg-white/[0.03] border border-white/10 rounded-xl p-3 text-[10px] outline-none focus:border-red-600"
                            placeholder="Ep Title"
                          />
                          <input 
                            type="text" 
                            value={ep.url} 
                            onChange={(e) => handleEpisodeChange(idx, 'url', e.target.value)}
                            className="flex-1 bg-white/[0.03] border border-white/10 rounded-xl p-3 text-[10px] outline-none focus:border-red-600"
                            placeholder="Video URL"
                          />
                          <button onClick={() => handleRemoveEpisode(idx)} className="p-3 text-red-500 bg-red-500/10 rounded-xl">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <button onClick={handleAddEpisode} className="w-full py-3 border-2 border-dashed border-white/10 rounded-xl text-gray-400 text-[10px] font-bold uppercase tracking-widest">
                      + Add Episode
                    </button>
                  </div>
                ) : (
                  <div className="relative group">
                    <input 
                      type="text" 
                      value={newMovie.VideoURL || ''} 
                      onChange={(e) => setNewMovie({ ...newMovie, VideoURL: e.target.value })} 
                      className="w-full bg-white/[0.03] border border-white/10 rounded-xl p-4 pl-12 outline-none focus:border-red-600 text-sm" 
                      placeholder="m3u8 link or iframe"
                    />
                    <Film className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" />
                  </div>
                )}
              </div>
              
              <div>
                <label className="text-[11px] text-gray-400 font-black uppercase mb-2 block tracking-widest">Thumbnail URL</label>
                <div className="flex gap-4 items-center">
                  <div 
                    className="w-16 h-20 bg-white/5 rounded-lg border border-white/10 overflow-hidden flex-shrink-0 cursor-pointer flex items-center justify-center"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {isUploading ? (
                      <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                    ) : newMovie.Thumbnail ? (
                      <img src={convertGoogleDriveUrl(newMovie.Thumbnail)} className="w-full h-full object-cover" />
                    ) : (
                      <Plus className="w-6 h-6 opacity-20" />
                    )}
                  </div>
                  <div className="flex-1 flex flex-col gap-2">
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={newMovie.Thumbnail || ''} 
                        onChange={(e) => setNewMovie({ ...newMovie, Thumbnail: e.target.value })} 
                        className="flex-1 bg-white/[0.03] border border-white/10 rounded-xl p-4 outline-none focus:border-red-600 text-sm" 
                        placeholder="Image URL" 
                      />
                      <input 
                        type="file" 
                        accept="image/*" 
                        ref={fileInputRef} 
                        className="hidden" 
                        onChange={(e) => e.target.files && handleImageUpload(e.target.files[0])} 
                      />
                      <button 
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="p-4 bg-blue-600/10 text-blue-500 border border-blue-500/20 rounded-xl hover:bg-blue-600 hover:text-white transition-all disabled:opacity-50"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-6 pb-2">
              <button 
                onClick={addMovieToStore} 
                disabled={isSubmitting}
                className="w-full bg-gradient-to-r from-red-600 to-red-700 font-black py-4 rounded-xl shadow-lg shadow-red-900/20 flex items-center justify-center gap-2 active:scale-95 transition-all text-sm uppercase tracking-widest"
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
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
