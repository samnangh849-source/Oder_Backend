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
  const hasBanner = !!originalAdminUser;

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
  const [activeTab, setActiveTab] = useState<'home' | 'movies' | 'mylist'>('home');
  const [myList, setMyList] = useState<string[]>(() => {
    const saved = localStorage.getItem('entertainment_mylist');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => { localStorage.setItem('entertainment_mylist', JSON.stringify(myList)); }, [myList]);

  const toggleMyList = (id: string) => {
    setMyList(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  useEffect(() => {
    if (guestMovieId && movies.length > 0) {
      const movie = movies.find(m => m.ID === guestMovieId);
      if (movie) setActiveMovie(movie);
    }
  }, [guestMovieId, movies]);

  const iframeContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeMovie && iframeContainerRef.current) {
      const container = iframeContainerRef.current;
      container.innerHTML = '';
      const isM3u8 = activeMovie.VideoURL.includes('.m3u8');
      const proxyM3u8Url = `${WEB_APP_URL}/api/proxy-m3u8?url=${encodeURIComponent(activeMovie.VideoURL)}`;
      const proxyUrl = `${WEB_APP_URL}/api/proxy-video?url=${encodeURIComponent(activeMovie.VideoURL)}`;
      
      let playerHtml = '';
      if (isM3u8) {
        playerHtml = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=0"><script src="https://cdn.jsdelivr.net/npm/hls.js@1.5.7/dist/hls.min.js"></script><style>body{margin:0;background:#000;display:flex;align-items:center;justify-content:center;height:100vh;overflow:hidden;}video{width:100%;height:100%;outline:none;}</style></head><body><video id="video" controls autoplay playsinline></video><script>var video=document.getElementById('video');var url='${proxyM3u8Url}';if(Hls.isSupported()){var hls=new Hls();hls.loadSource(url);hls.attachMedia(video);}else if(video.canPlayType('application/vnd.apple.mpegurl')){video.src=url;}</script></body></html>`;
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

  const MovieRow = ({ title, items }: { title: string, items: Movie[] }) => (
    <div className="mb-6 px-4">
      <h3 className="text-sm font-bold mb-3 uppercase tracking-wider opacity-60">{title}</h3>
      <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar">
        {items.map(movie => (
          <div key={movie.ID} className="relative min-w-[120px] aspect-[2/3]" onClick={() => setActiveMovie(movie)}>
            <img src={movie.Thumbnail} alt={movie.Title} className="w-full h-full object-cover rounded-md" />
            <div className="absolute top-1 right-1">
               <button onClick={(e) => { e.stopPropagation(); toggleMyList(movie.ID); }} className="p-1 bg-black/40 backdrop-blur-md rounded-full">
                  {myList.includes(movie.ID) ? <Check className="w-3 h-3 text-red-600" /> : <Plus className="w-3 h-3 text-white" />}
               </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#080808] text-white font-['Kantumruy_Pro'] pb-20">
      <nav className="sticky top-0 z-[60] px-4 py-3 bg-black/60 backdrop-blur-xl flex items-center justify-between">
        <div className="flex items-center gap-3">
           <button onClick={() => setAppState('role_selection')} className="p-1.5 bg-white/5 rounded-full"><ChevronLeft className="w-5 h-5" /></button>
           <h1 className="text-lg font-black italic">O-<span className="text-red-600">ENT</span></h1>
        </div>
        <div className="flex gap-4">
           <Search className="w-5 h-5 opacity-40" />
           <div className="w-7 h-7 rounded-full bg-red-600 flex items-center justify-center text-[10px] font-bold">
              {currentUser?.UserName?.substring(0, 1).toUpperCase()}
           </div>
        </div>
      </nav>

      <div className="flex gap-6 px-4 py-4 text-xs font-bold uppercase opacity-60">
         <button onClick={() => setActiveTab('home')} className={activeTab === 'home' ? 'text-white border-b-2 border-red-600 pb-1' : ''}>Home</button>
         <button onClick={() => setActiveTab('movies')} className={activeTab === 'movies' ? 'text-white border-b-2 border-red-600 pb-1' : ''}>Movies</button>
         <button onClick={() => setActiveTab('mylist')} className={activeTab === 'mylist' ? 'text-white border-b-2 border-red-600 pb-1' : ''}>My List</button>
      </div>

      {movies.length > 0 && activeTab === 'home' && (
        <div className="relative w-full aspect-square mb-8" onClick={() => setActiveMovie(movies[0])}>
           <img src={movies[0].Thumbnail} className="w-full h-full object-cover" />
           <div className="absolute inset-0 bg-gradient-to-t from-[#080808] via-transparent to-transparent flex flex-col justify-end p-6 items-center text-center">
              <h2 className="text-3xl font-black italic uppercase mb-4">{movies[0].Title}</h2>
              <div className="flex gap-4">
                 <button className="bg-white text-black px-6 py-2 rounded-sm font-bold text-sm flex items-center gap-2"><Play className="w-4 h-4 fill-current" /> Play</button>
                 <button onClick={(e) => { e.stopPropagation(); toggleMyList(movies[0].ID); }} className="bg-white/10 px-6 py-2 rounded-sm font-bold text-sm flex items-center gap-2 backdrop-blur-md border border-white/10"><Plus className="w-4 h-4" /> My List</button>
              </div>
           </div>
        </div>
      )}

      <main>
         {activeTab === 'home' && (
           <>
             <MovieRow title="Trending" items={movies.slice(0, 6)} />
             <MovieRow title="Recently Added" items={movies.slice().reverse().slice(0, 6)} />
           </>
         )}
         {activeTab === 'movies' && <MovieRow title="All Movies" items={movies} />}
         {activeTab === 'mylist' && <MovieRow title="My List" items={movies.filter(m => myList.includes(m.ID))} />}
      </main>

      {activeMovie && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col">
           <div className="p-4 flex items-center justify-between">
              <button onClick={() => setActiveMovie(null)}><X className="w-8 h-8" /></button>
              <h2 className="text-sm font-bold italic truncate px-4">{activeMovie.Title}</h2>
              <Share2 className="w-5 h-5" />
           </div>
           <div className="flex-1" ref={iframeContainerRef}></div>
           <div className="p-4 bg-[#141414] text-xs">
              <p className="opacity-60 leading-relaxed">{activeMovie.Description}</p>
           </div>
        </div>
      )}
    </div>
  );
};

export default MobileNetflixEntertainment;
