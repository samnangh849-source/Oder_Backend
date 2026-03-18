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

  const filteredMovies = movies.filter(m => m.Title.toLowerCase().includes(searchQuery.toLowerCase()));
  const trendingMovies = filteredMovies.slice(0, 5);
  const shortFilms = filteredMovies.filter(m => m.Type === 'short');
  const longFilms = filteredMovies.filter(m => m.Type === 'long');
  const series = filteredMovies.filter(m => m.Type === 'series');

  useEffect(() => {
    if (activeMovie && iframeContainerRef.current) {
      const container = iframeContainerRef.current;
      container.innerHTML = '';
      const isM3u8 = activeMovie.VideoURL.includes('.m3u8');
      const proxyM3u8Url = `${WEB_APP_URL}/api/proxy-m3u8?url=${encodeURIComponent(activeMovie.VideoURL)}`;
      const proxyUrl = `${WEB_APP_URL}/api/proxy-video?url=${encodeURIComponent(activeMovie.VideoURL)}`;
      
      let playerHtml = '';
      if (isM3u8) {
        playerHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta name="referrer" content="no-referrer">
            <script src="https://cdn.jsdelivr.net/npm/hls.js@1.5.7/dist/hls.min.js"></script>
            <style>
              body { margin: 0; background: #000; display: flex; align-items: center; justify-content: center; height: 100vh; overflow: hidden; }
              video { width: 100%; height: 100%; outline: none; background: #000; }
            </style>
          </head>
          <body>
            <video id="video" controls autoplay playsinline></video>
            <script>
              var video = document.getElementById('video');
              var url = '${proxyM3u8Url}';
              if (Hls.isSupported()) {
                var hls = new Hls();
                hls.loadSource(url);
                hls.attachMedia(video);
              } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                video.src = url;
              }
            </script>
          </body>
          </html>
        `;
      } else if (activeMovie.VideoURL.includes('<iframe')) {
        playerHtml = `<!DOCTYPE html><html><head><meta name="referrer" content="no-referrer"><style>body{margin:0;background:#000;display:flex;align-items:center;justify-content:center;height:100vh;overflow:hidden;}iframe{width:100%;height:100%;border:none;}</style></head><body>${activeMovie.VideoURL}</body></html>`;
      } else {
        playerHtml = `<!DOCTYPE html><html><head><meta name="referrer" content="no-referrer"><style>body{margin:0;background:#000;display:flex;align-items:center;justify-content:center;height:100vh;overflow:hidden;}iframe{width:100%;height:100%;border:none;}</style></head><body><iframe src="${proxyUrl}" allowfullscreen="true" frameborder="0" referrerpolicy="no-referrer"></iframe></body></html>`;
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

  const MovieRow = ({ title, items }: { title: string, items: Movie[] }) => (
    <div className="mb-8 px-12">
      <h3 className="text-xl font-bold mb-4 uppercase tracking-tight">{title}</h3>
      <div className="flex gap-4 overflow-x-auto pb-8 no-scrollbar scroll-smooth">
        {items.map(movie => (
          <div key={movie.ID} className="relative min-w-[240px] aspect-[2/3] group cursor-pointer transition-all hover:scale-105" onClick={() => setActiveMovie(movie)}>
            <img src={movie.Thumbnail} alt={movie.Title} className="w-full h-full object-cover rounded-md shadow-lg" />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-4 flex flex-col justify-end">
              <h4 className="font-bold text-sm mb-1">{movie.Title}</h4>
              <div className="flex gap-2">
                <button className="bg-white text-black p-2 rounded-full"><Play className="w-3 h-3 fill-current" /></button>
                <button onClick={(e) => { e.stopPropagation(); toggleMyList(movie.ID); }} className="bg-white/20 p-2 rounded-full">{myList.includes(movie.ID) ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}</button>
                {isAdmin && <button onClick={(e) => { e.stopPropagation(); deleteMovie(movie.ID); }} className="bg-red-500/20 p-2 rounded-full ml-auto"><Trash2 className="w-3 h-3" /></button>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#080808] text-white font-['Kantumruy_Pro']">
      <nav className={`fixed w-full z-[60] px-10 py-4 flex items-center justify-between transition-all ${scrolled ? 'bg-black/80 backdrop-blur-md' : 'bg-gradient-to-b from-black to-transparent'}`} style={{ top: hasBanner ? '44px' : '0' }}>
        <div className="flex items-center gap-10">
          <button onClick={() => setAppState('role_selection')} className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-all"><ChevronLeft className="w-6 h-6" /></button>
          <div className="flex flex-col">
            <h1 className="text-2xl font-black italic">O-<span className="text-red-600">ENTERTAINMENT</span></h1>
            <span className="text-[8px] opacity-30 uppercase tracking-widest">Desktop Experience</span>
          </div>
          <div className="hidden lg:flex gap-8 text-[11px] font-black uppercase opacity-40">
            {['home', 'tv', 'movies', 'mylist', 'games'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab as any)} className={activeTab === tab ? 'text-white' : ''}>{tab}</button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-6">
          <Search className="w-6 h-6 opacity-40" />
          {isAdmin && (
            <>
              <button onClick={() => setShowAddModal(true)} className="p-2 bg-white/5 rounded-xl border border-white/10"><Plus className="w-5 h-5" /></button>
              <button onClick={() => setShowProxy(!showProxy)} className={`p-2 rounded-xl border ${showProxy ? 'bg-red-600 border-red-500' : 'bg-white/5 border-white/5'}`}><Server className="w-5 h-5" /></button>
            </>
          )}
        </div>
      </nav>

      {billboardMovie && activeTab === 'home' && (
        <div className="relative w-full h-[85vh]">
          <img src={billboardMovie.Thumbnail} alt={billboardMovie.Title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/40 to-transparent flex flex-col justify-center px-12">
            <h2 className="text-7xl font-black italic uppercase mb-4">{billboardMovie.Title}</h2>
            <p className="text-lg text-gray-300 max-w-2xl mb-8 leading-relaxed">{billboardMovie.Description}</p>
            <div className="flex gap-4">
              <button onClick={() => setActiveMovie(billboardMovie)} className="bg-white text-black px-10 py-4 rounded font-black flex items-center gap-3"><Play className="w-6 h-6 fill-current" /> Play Now</button>
              <button onClick={() => setShowDetails(billboardMovie)} className="bg-gray-500/50 px-10 py-4 rounded font-black flex items-center gap-3"><Info className="w-6 h-6" /> Details</button>
            </div>
          </div>
          <div className="absolute bottom-0 w-full h-32 bg-gradient-to-t from-[#080808] to-transparent"></div>
        </div>
      )}

      <main className={`relative z-10 ${billboardMovie ? '-mt-32' : 'pt-32'} pb-20`}>
        {showProxy && isAdmin && (
          <div className="mx-12 bg-black/80 border border-red-600/30 rounded-2xl p-8 mb-12 backdrop-blur-xl">
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
        <MovieRow title="Trending Now" items={trendingMovies} />
        <MovieRow title="Khmer Series" items={series} />
        <MovieRow title="Feature Movies" items={longFilms} />
        <MovieRow title="Short Films" items={shortFilms} />
      </main>

      {activeMovie && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col">
          <div className="p-10 flex items-center justify-between bg-gradient-to-b from-black to-transparent relative z-10">
            <button onClick={() => setActiveMovie(null)} className="text-white hover:scale-110 transition-transform"><X className="w-12 h-12" /></button>
            <h2 className="text-4xl font-black italic">{activeMovie.Title}</h2>
            <button onClick={() => handleShare(activeMovie)} className="bg-white/10 px-6 py-3 rounded-full text-xs font-black uppercase tracking-widest"><Share2 className="w-4 h-4" /></button>
          </div>
          <div className="flex-1" ref={iframeContainerRef}></div>
        </div>
      )}

      {showAddModal && (
        <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title={t.add_movie}>
          <div className="space-y-6 text-white p-2">
            <div><label className="text-[10px] text-gray-500 font-black uppercase mb-2 block">{t.title}</label><input type="text" value={newMovie.Title || ''} onChange={(e) => setNewMovie({ ...newMovie, Title: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 outline-none" /></div>
            <div><label className="text-[10px] text-gray-500 font-black uppercase mb-2 block">{t.m3u8_link}</label><input type="text" value={newMovie.VideoURL || ''} onChange={(e) => setNewMovie({ ...newMovie, VideoURL: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 outline-none" /></div>
            <div><label className="text-[10px] text-gray-500 font-black uppercase mb-2 block">{t.thumbnail_url}</label><input type="text" value={newMovie.Thumbnail || ''} onChange={(e) => setNewMovie({ ...newMovie, Thumbnail: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 outline-none" /></div>
            <button onClick={addMovieToStore} className="w-full bg-red-600 font-black py-4 rounded-xl shadow-xl transition-all">Save Movie</button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default DesktopNetflixEntertainment;
