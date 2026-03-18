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
import { fileToBase64, convertGoogleDriveUrl } from '../../../utils/fileUtils';
import { compressImage } from '../../../utils/imageCompressor';

import MoviePlayer from './MoviePlayer';
import SeriesPlayerView from './SeriesPlayerView';

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
  const [showSearchInput, setShowSearchInput] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showSearchInput && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showSearchInput]);

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

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleShare = (movie: Movie) => {
    const shareUrl = `${window.location.origin}${window.location.pathname}?view=watch&movie=${movie.ID}`;
    navigator.clipboard.writeText(shareUrl);
    showNotification("Link copied! Guests can watch this movie without login.", "success");
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

      // 1. Check for playlists array (zip model)
      const playlistsMatch = htmlContent.match(/const playlists = (\[.*?\]);/s);
      if (playlistsMatch) {
        const fileMatches = [...playlistsMatch[1].matchAll(/file:\s*["']([^"']+(\.m3u8|\/hlsplaylist\/|\/hls\/)[^"']*)["']/g)];
        if (fileMatches.length > 0) {
          let url = fileMatches[0][1];
          if (url.startsWith('//')) url = 'https:' + url;
          setExtractedM3u8(url);
          setStatus('success');
          return;
        }
      }

      // 2. Check for dooplay_player_option (zip model)
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
            const tryFetch = async (url: string, isAjax: boolean = false) => {
                try {
                  const fetchUrl = `${WEB_APP_URL}/api/fetch-json?url=${encodeURIComponent(url)}`;
                  const res = await fetch(fetchUrl, { method: isAjax ? 'POST' : 'GET' });
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
                          return true;
                        }
                      }
                      setExtractedM3u8(embedUrl);
                      return true;
                    }
                  }
                } catch (e) { console.warn(e); }
                return false;
            };

            let success = false;
            if (playerApi) success = await tryFetch(`${playerApi}${postId}/${type}/${nume}`);
            if (!success && ajaxUrlBase) success = await tryFetch(`${ajaxUrlBase}?action=doo_player_ajax&post=${postId}&nume=${nume}&type=${type}`, true);
            
            if (success) { setStatus('success'); return; }
          }
        }
      }

      // 3. Fallback to Iframe search
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

      // 4. Direct m3u8 search
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

  const addMovieToStore = async () => {
    if (!newMovie.Title) {
      showNotification("Please enter a title", "error");
      return;
    }

    setIsSubmitting(true);
    try {
        const token = localStorage.getItem('token');
        
        if (newMovie.Type === 'series') {
          // Validate episodes
          const validEpisodes = episodes.filter(ep => ep.title && ep.url);
          if (validEpisodes.length === 0) {
            showNotification("Please add at least one episode with a URL", "error");
            setIsSubmitting(false);
            return;
          }

          // Bulk upload episodes
          let successCount = 0;
          for (const ep of validEpisodes) {
            const payload = {
              ...newMovie,
              Title: ep.title,
              VideoURL: ep.url,
              SeriesKey: newMovie.SeriesKey || newMovie.Title // Use Title as default SeriesKey if empty
            };
            const response = await fetch(`${WEB_APP_URL}/api/admin/movies`, {
                method: 'POST',
                headers: { 
                  'Content-Type': 'application/json',
                  ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify(payload)
            });
            if (response.ok) successCount++;
          }
          showNotification(`${successCount} episodes added successfully`, "success");
        } else {
          // Single movie upload
          if (!newMovie.VideoURL) {
            showNotification("Please enter a Video URL", "error");
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
          if (response.ok) {
              showNotification("Movie added successfully", "success");
          }
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
                headers: {
                  ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                }
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
          <div className="hidden lg:flex gap-7 text-[13px] font-bold uppercase tracking-wide opacity-50 mt-1">
            {[
              { id: 'home', label: t.today || 'Home' },
              { id: 'tv', label: t.series || 'TV' },
              { id: 'movies', label: t.movies || 'Movies' },
              { id: 'mylist', label: 'My List' }
            ].map(tab => (
              <button key={tab.id} onClick={() => { setActiveTab(tab.id as any); setSelectedCategory(null); }} className={`transition-all ${activeTab === tab.id ? 'text-white opacity-100' : 'hover:opacity-100 hover:text-white'}`}>{tab.label}</button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className={`flex items-center transition-all duration-300 relative ${showSearchInput || searchQuery ? 'w-64 bg-black/40 border-white/20' : 'w-10 bg-transparent border-transparent'} border rounded-sm h-9`}>
            <button 
              onClick={() => setShowSearchInput(!showSearchInput)}
              className="p-2 text-white/70 hover:text-white transition-colors"
            >
              <Search className="w-5 h-5" />
            </button>
            <input 
              ref={searchInputRef}
              type="text" 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
              onBlur={() => { if (!searchQuery) setShowSearchInput(false); }}
              placeholder={t.search_placeholder || "Titles, people, genres"} 
              className={`bg-transparent text-white text-xs outline-none transition-all duration-300 w-full ${showSearchInput || searchQuery ? 'opacity-100 px-1' : 'opacity-0 w-0'}`}
            />
            {(searchQuery) && (
              <button 
                onClick={() => { setSearchQuery(''); setShowSearchInput(false); }}
                className="p-2 text-white/40 hover:text-white/80"
              >
                <X className="w-4 h-4" />
              </button>
            )}
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
        
        {activeTab === 'home' && !selectedCategory && !searchQuery && (
          <>
            <MovieRow title="Trending Now" items={trendingMovies} />
            <MovieRow title="Khmer Series" items={series.filter(m => m.Country === 'Cambodia').slice(0, 10)} />
            <MovieRow title="Trending Series" items={series.filter(m => m.Country !== 'Cambodia').slice(0, 10)} />
            <MovieRow title="Feature Movies" items={longFilms.slice(0, 10)} />
            <MovieRow title="Short Films" items={shortFilms.slice(0, 10)} />
          </>
        )}

        {(selectedCategory || searchQuery || activeTab !== 'home') && (
          <MovieRow 
            title={selectedCategory ? `${selectedCategory} Movies` : activeTab === 'tv' ? 'TV Series' : activeTab === 'movies' ? 'Feature Movies' : 'Results'} 
            items={finalFilteredMovies} 
          />
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
            isMobile={false}
            onClose={() => setActiveMovie(null)}
            onShare={handleShare}
            watchProgress={watchProgress}
            onSaveProgress={saveProgress}
            relatedMovies={movies.filter(m => m.ID !== activeMovie.ID && (m.Category === activeMovie.Category || m.Type === activeMovie.Type)).slice(0, 10)}
            onSelectMovie={setActiveMovie}
          />
        )
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
        <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)}>
          <div className="flex flex-col h-full bg-[#141414] text-white">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10 sticky top-0 bg-[#141414] z-10">
              <h2 className="text-lg font-black italic uppercase tracking-wider px-2">
                {t.add_movie || "Add New Movie"}
              </h2>
              <button 
                onClick={() => setShowAddModal(false)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-6 p-6 overflow-y-auto no-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="col-span-1 md:col-span-2 relative">
                <label className="text-[11px] text-gray-400 font-black uppercase mb-2 block tracking-widest">{t.title}</label>
                <div className="flex gap-3">
                  <input 
                    type="text" 
                    value={newMovie.Title || ''} 
                    onChange={(e) => setNewMovie({ ...newMovie, Title: e.target.value })} 
                    className="flex-1 bg-white/[0.03] border border-white/10 rounded-xl p-4 outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600/30 transition-all placeholder:text-gray-600 shadow-inner" 
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
                           showNotification("No smart data found. Enter manually.", "warning");
                        }
                      } catch(e) {
                         showNotification("Smart Fetch failed.", "error");
                      }
                      setIsSubmitting(false);
                    }}
                    className="bg-gradient-to-br from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 px-6 rounded-xl font-bold text-xs flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-blue-900/20 disabled:opacity-50"
                    disabled={!newMovie.Title || isSubmitting}
                  >
                    <Search className="w-4 h-4" /> {isSubmitting ? 'Fetching...' : 'Smart Fetch'}
                  </button>
                </div>
              </div>
              
              <div className="col-span-1 md:col-span-2">
                <label className="text-[11px] text-gray-400 font-black uppercase mb-2 block tracking-widest">Description</label>
                <textarea 
                  value={newMovie.Description || ''} 
                  onChange={(e) => setNewMovie({ ...newMovie, Description: e.target.value })} 
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl p-4 outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600/30 transition-all h-28 resize-none placeholder:text-gray-600 shadow-inner" 
                  placeholder="Movie description..." 
                />
              </div>

              <div>
                <label className="text-[11px] text-gray-400 font-black uppercase mb-2 block tracking-widest">Type</label>
                <div className="relative">
                  <select 
                    value={newMovie.Type || 'long'} 
                    onChange={(e) => setNewMovie({ ...newMovie, Type: e.target.value as any })} 
                    className="w-full bg-white/[0.03] border border-white/10 rounded-xl p-4 outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600/30 transition-all appearance-none cursor-pointer"
                  >
                    <option value="long" className="bg-[#1a1a1a]">Feature Movie</option>
                    <option value="short" className="bg-[#1a1a1a]">Short Film</option>
                    <option value="series" className="bg-[#1a1a1a]">TV Series</option>
                  </select>
                  <ChevronLeft className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 -rotate-90 pointer-events-none opacity-50" />
                </div>
              </div>

              <div>
                <label className="text-[11px] text-gray-400 font-black uppercase mb-2 block tracking-widest">Category</label>
                <div className="flex flex-col gap-2">
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
                      className="w-full bg-white/[0.03] border border-white/10 rounded-xl p-4 outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600/30 transition-all appearance-none cursor-pointer"
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
                      <option value="Other" className="bg-[#1a1a1a]">Other (Custom)</option>
                    </select>
                    <ChevronLeft className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 -rotate-90 pointer-events-none opacity-50" />
                  </div>
                  {!['Action', 'Adventure', 'Animation', 'Comedy', 'Documentary', 'Drama', 'Fantasy', 'Horror', 'Mystery', 'Romance', 'Sci-Fi', 'Thriller'].includes(newMovie.Category || '') && (
                    <input 
                      type="text" 
                      value={newMovie.Category || ''} 
                      onChange={(e) => setNewMovie({ ...newMovie, Category: e.target.value })} 
                      className="w-full bg-white/[0.05] border border-red-600/30 rounded-xl p-4 outline-none focus:border-red-600 transition-all animate-[slide-down_0.2s_ease-out]" 
                      placeholder="Enter genre..." 
                      autoFocus
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="text-[11px] text-gray-400 font-black uppercase mb-2 block tracking-widest">Language</label>
                <input 
                  type="text" 
                  value={newMovie.Language || 'Khmer'} 
                  onChange={(e) => setNewMovie({ ...newMovie, Language: e.target.value })} 
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl p-4 outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600/30 transition-all placeholder:text-gray-600" 
                  placeholder="Language" 
                />
              </div>

              <div>
                <label className="text-[11px] text-gray-400 font-black uppercase mb-2 block tracking-widest">Country</label>
                <input 
                  type="text" 
                  value={newMovie.Country || 'Cambodia'} 
                  onChange={(e) => setNewMovie({ ...newMovie, Country: e.target.value })} 
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl p-4 outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600/30 transition-all placeholder:text-gray-600" 
                  placeholder="Country" 
                />
              </div>

              {newMovie.Type === 'series' && (
                <div className="col-span-1 md:col-span-2">
                  <label className="text-[11px] text-gray-400 font-black uppercase mb-2 block tracking-widest text-red-500">Series ID / Group Key (បង្រួមភាគរឿង)</label>
                  <input 
                    type="text" 
                    value={newMovie.SeriesKey || ''} 
                    onChange={(e) => setNewMovie({ ...newMovie, SeriesKey: e.target.value })} 
                    className="w-full bg-red-600/5 border border-red-600/30 rounded-xl p-4 outline-none focus:border-red-600 transition-all placeholder:text-gray-700 font-bold" 
                    placeholder="ឧទាហរណ៍៖ SQUID_GAME_S1" 
                  />
                  <p className="text-[9px] text-gray-500 mt-2 italic font-bold uppercase tracking-tighter">ចំណាំ៖ រាល់ភាគទាំងអស់នៃរឿងតែមួយ ត្រូវតែមាន Group Key ដូចគ្នាដើម្បីឱ្យប្រព័ន្ធស្គាល់ថាជាភាគបន្តគ្នា។</p>
                </div>
              )}

              <div className="col-span-1 md:col-span-2">
                <label className="text-[11px] text-gray-400 font-black uppercase mb-2 block tracking-widest">{t.m3u8_link}</label>
                {newMovie.Type === 'series' ? (
                  <div className="space-y-4">
                    <div className="max-h-60 overflow-y-auto pr-2 space-y-3 no-scrollbar">
                      {episodes.map((ep, idx) => (
                        <div key={idx} className="flex gap-3 animate-[slide-in_0.2s_ease-out]">
                          <input 
                            type="text" 
                            value={ep.title} 
                            onChange={(e) => handleEpisodeChange(idx, 'title', e.target.value)}
                            className="w-1/3 bg-white/[0.03] border border-white/10 rounded-xl p-3 text-xs outline-none focus:border-red-600 transition-all"
                            placeholder="Ep Title"
                          />
                          <input 
                            type="text" 
                            value={ep.url} 
                            onChange={(e) => handleEpisodeChange(idx, 'url', e.target.value)}
                            className="flex-1 bg-white/[0.03] border border-white/10 rounded-xl p-3 text-xs outline-none focus:border-red-600 transition-all"
                            placeholder="Video URL"
                          />
                          <button 
                            onClick={() => handleRemoveEpisode(idx)}
                            className="p-3 text-red-500 hover:bg-red-500/10 rounded-xl transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <button 
                      onClick={handleAddEpisode}
                      className="w-full py-3 border-2 border-dashed border-white/10 rounded-xl text-gray-400 hover:text-white hover:border-white/20 transition-all flex items-center justify-center gap-2 font-bold text-xs"
                    >
                      <Plus className="w-4 h-4" /> Add More Episode
                    </button>
                  </div>
                ) : (
                  <div className="relative group">
                    <input 
                      type="text" 
                      value={newMovie.VideoURL || ''} 
                      onChange={(e) => setNewMovie({ ...newMovie, VideoURL: e.target.value })} 
                      className="w-full bg-white/[0.03] border border-white/10 rounded-xl p-4 pl-12 outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600/30 transition-all placeholder:text-gray-600" 
                      placeholder="HLS/M3U8 or Embed URL" 
                    />
                    <Film className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-red-500 transition-colors" />
                  </div>
                )}
              </div>
              
              <div className="col-span-1 md:col-span-2">
                <label className="text-[11px] text-gray-400 font-black uppercase mb-2 block tracking-widest">{t.thumbnail_url}</label>
                <div className="flex gap-4">
                  <div 
                    className="w-24 h-32 bg-white/5 rounded-xl border border-white/10 overflow-hidden flex-shrink-0 shadow-lg cursor-pointer flex items-center justify-center"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {isUploading ? (
                      <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                    ) : newMovie.Thumbnail ? (
                      <img src={convertGoogleDriveUrl(newMovie.Thumbnail)} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-600">
                        <Plus className="w-8 h-8 opacity-20" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 flex flex-col gap-3 self-center">
                    <div className="flex gap-3">
                      <input 
                        type="text" 
                        value={newMovie.Thumbnail || ''} 
                        onChange={(e) => setNewMovie({ ...newMovie, Thumbnail: e.target.value })} 
                        className="flex-1 bg-white/[0.03] border border-white/10 rounded-xl p-4 outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600/30 transition-all placeholder:text-gray-600" 
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
                        className="px-6 bg-blue-600/10 text-blue-500 border border-blue-500/20 rounded-xl hover:bg-blue-600 hover:text-white transition-all disabled:opacity-50 flex items-center gap-2 font-bold text-xs"
                      >
                        <Plus className="w-4 h-4" /> {isUploading ? "Uploading..." : "Upload Image"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-8 flex gap-4">
              <button 
                onClick={() => setShowAddModal(false)} 
                className="flex-1 py-4 px-6 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-bold transition-all active:scale-95 tracking-wide"
              >
                Cancel
              </button>
              <button 
                onClick={addMovieToStore} 
                disabled={isSubmitting}
                className="flex-[2] py-4 px-6 rounded-2xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-black transition-all active:scale-[0.98] shadow-lg shadow-red-900/40 flex items-center justify-center gap-2 group tracking-widest uppercase text-sm"
              >
                {isSubmitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    Save Movie
                  </>
                )}
              </button>
            </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default DesktopNetflixEntertainment;
