import React, { useContext, useEffect, useState } from 'react';
import { AppContext } from '../context/AppContext';
import UserAvatar from '../components/common/UserAvatar';
import { convertGoogleDriveUrl } from '../utils/fileUtils';
import { APP_LOGO_URL } from '../constants';

interface RoleSelectionPageProps {
    onSelect: (role: 'admin_dashboard' | 'user_journey' | 'fulfillment') => void;
}

const RoleSelectionPage: React.FC<RoleSelectionPageProps> = ({ onSelect }) => {
    const { currentUser, hasPermission } = useContext(AppContext);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!currentUser) return null;

    const showAdmin = currentUser.IsSystemAdmin || currentUser.Role?.toLowerCase() === 'admin';
    const showFulfillment = hasPermission('access_fulfillment');
    const showSales = hasPermission('access_sales_portal');

    // Count how many modules are visible to adjust grid layout
    const visibleCount = (showAdmin ? 1 : 0) + (showFulfillment ? 1 : 0) + (showSales ? 1 : 0);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 bg-transparent relative overflow-hidden">
            {/* Background Decorative Blobs - Optimized for Mobile */}
            <div className="absolute top-[-5%] left-[-10%] w-[300px] sm:w-[500px] h-[300px] sm:h-[500px] bg-blue-600/10 rounded-full blur-[80px] sm:blur-[120px] animate-pulse pointer-events-none"></div>
            <div className="absolute bottom-[-5%] right-[-10%] w-[300px] sm:w-[500px] h-[300px] sm:h-[500px] bg-indigo-600/10 rounded-full blur-[80px] sm:blur-[120px] animate-pulse pointer-events-none" style={{ animationDelay: '2s' }}></div>

            <style>{`
                @keyframes float {
                    0%, 100% { transform: translateY(0px); }
                    50% { transform: translateY(-8px); }
                }
                .animate-float { animation: float 4s ease-in-out infinite; }
                
                @keyframes reveal {
                    from { opacity: 0; transform: scale(0.95) translateY(20px); filter: blur(8px); }
                    to { opacity: 1; transform: scale(1) translateY(0); filter: blur(0); }
                }
                
                @keyframes profile-reveal {
                    0% { opacity: 0; transform: scale(0.7) rotate(-10deg); filter: blur(15px); }
                    100% { opacity: 1; transform: scale(1) rotate(0deg); filter: blur(0); }
                }
                
                @keyframes ring-rotate-cw {
                    from { transform: translate(-50%, -50%) rotate(0deg); }
                    to { transform: translate(-50%, -50%) rotate(360deg); }
                }
                
                @keyframes status-ripple {
                    0% { transform: translate(-50%, -50%) scale(1); opacity: 0.4; }
                    100% { transform: translate(-50%, -50%) scale(1.4); opacity: 0; }
                }

                .profile-entrance { animation: profile-reveal 1s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
                .reveal-0 { animation: reveal 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) 0.3s forwards; opacity: 0; }
                .reveal-1 { animation: reveal 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) 0.5s forwards; opacity: 0; }
                .reveal-2 { animation: reveal 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) 0.6s forwards; opacity: 0; }
                .reveal-3 { animation: reveal 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) 0.7s forwards; opacity: 0; }
                
                .premium-glass-mobile {
                    background: rgba(15, 23, 42, 0.4);
                    backdrop-filter: blur(20px) saturate(160%);
                    -webkit-backdrop-filter: blur(20px) saturate(160%);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    box-shadow: 0 15px 35px -12px rgba(0, 0, 0, 0.6);
                }
                
                /* Mobile-specific button tap effect */
                .role-btn:active { 
                    transform: scale(0.96);
                    background: rgba(255, 255, 255, 0.05);
                }

                .status-ring-mobile { 
                    position: absolute; top: 50%; left: 50%; width: 120%; height: 120%; 
                    border: 1.5px dashed rgba(59, 130, 246, 0.3); border-radius: 50%;
                    animation: ring-rotate-cw 12s linear infinite;
                }
                
                .status-ripple-mobile {
                    position: absolute; top: 50%; left: 50%; width: 100%; height: 100%;
                    border-radius: 50%; border: 3px solid rgba(59, 130, 246, 0.3);
                    animation: status-ripple 2s infinite ease-out;
                }

                .tap-indicator {
                    width: 4px;
                    height: 4px;
                    background: #3b82f6;
                    border-radius: 50%;
                    box-shadow: 0 0 10px #3b82f6;
                    animation: pulse 1.5s infinite;
                }

                @keyframes pulse {
                    0% { transform: scale(1); opacity: 1; }
                    100% { transform: scale(3); opacity: 0; }
                }
            `}</style>

            <div className="w-full max-w-lg sm:max-w-6xl z-10 space-y-10 sm:space-y-16">
                {/* Header Welcome Section */}
                <div className="text-center px-2">
                    <div className="inline-block relative mb-8 sm:mb-12 profile-entrance">
                        {/* Holographic Status Rings */}
                        <div className="status-ripple-mobile"></div>
                        <div className="status-ring-mobile"></div>
                        
                        <div className="absolute inset-0 bg-blue-500/10 rounded-full blur-2xl animate-pulse"></div>
                        
                        <UserAvatar 
                            avatarUrl={currentUser.ProfilePictureURL} 
                            name={currentUser.FullName} 
                            size="xl"
                            className="w-24 h-24 sm:w-36 sm:h-36 border-[4px] sm:border-[6px] border-gray-950 shadow-2xl relative z-10 ring-1 ring-white/10"
                        />
                        
                        {/* Verified Badge - Resized for Mobile */}
                        <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 sm:w-10 sm:h-10 bg-blue-600 rounded-lg sm:rounded-2xl flex items-center justify-center border-2 sm:border-4 border-gray-950 shadow-lg text-white z-20 animate-float">
                            <svg className="w-3 h-3 sm:w-6 sm:h-6" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                        </div>
                    </div>
                    
                    <div className="reveal-0">
                        <h2 className="text-blue-500 font-black uppercase tracking-[0.3em] text-[9px] sm:text-[10px] mb-3">System Access Authorization</h2>
                        <h1 className="text-3xl sm:text-6xl font-black text-white tracking-tighter mb-3 italic leading-none">
                            សួស្តី, <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">{currentUser.FullName.split(' ')[0]}</span>
                        </h1>
                        <p className="text-gray-500 text-sm sm:text-lg font-bold max-w-xs sm:max-w-md mx-auto leading-relaxed opacity-80">
                            សូមជ្រើសរើសទិសដៅសម្រាប់ <span className="text-blue-500 font-black">O-System</span>
                        </p>
                    </div>
                </div>

                {/* Role Selection - Specialized Grid */}
                <div className={`grid grid-cols-1 ${visibleCount === 3 ? 'md:grid-cols-3' : visibleCount === 2 ? 'md:grid-cols-2' : 'md:grid-cols-1'} gap-4 sm:gap-8 w-full px-2 max-w-5xl mx-auto`}>
                    {/* ADMIN ROLE */}
                    {showAdmin && (
                        <button 
                            onClick={() => onSelect('admin_dashboard')}
                            className="role-btn premium-glass-mobile p-5 sm:p-8 rounded-[2rem] text-left transition-all duration-300 reveal-1 flex md:flex-col items-center md:items-start gap-5 sm:gap-0 border hover:border-blue-500/50 group"
                        >
                            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center text-white sm:mb-6 transition-all shadow-xl flex-shrink-0 group-hover:scale-110">
                                <svg className="w-7 h-7 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                                    <path d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                                    <path d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                                </svg>
                            </div>
                            <div className="flex-grow min-w-0">
                                <h3 className="text-lg sm:text-xl font-black text-white uppercase tracking-tight mb-1">គ្រប់គ្រងប្រព័ន្ធ</h3>
                                <p className="text-[11px] sm:text-[12px] text-gray-500 font-bold leading-snug opacity-70">
                                    ផ្ទាំងបញ្ជាលក់ របាយការណ៍ និងការកំណត់។
                                </p>
                            </div>
                            <div className="md:mt-6 hidden sm:flex items-center gap-2 text-blue-500 font-black text-[10px] uppercase tracking-widest">
                                <span>Admin Console</span>
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M13 7l5 5-5 5" /></svg>
                            </div>
                        </button>
                    )}

                    {/* FULFILLMENT ROLE */}
                    {showFulfillment && (
                        <button 
                            onClick={() => onSelect('fulfillment')}
                            className="role-btn premium-glass-mobile p-5 sm:p-8 rounded-[2rem] text-left transition-all duration-300 reveal-2 flex md:flex-col items-center md:items-start gap-5 sm:gap-0 border hover:border-amber-500/50 group"
                        >
                            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center text-white sm:mb-6 transition-all shadow-xl flex-shrink-0 group-hover:scale-110">
                                <svg className="w-7 h-7 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                                    <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                </svg>
                            </div>
                            <div className="flex-grow min-w-0">
                                <h3 className="text-lg sm:text-xl font-black text-white uppercase tracking-tight mb-1">វេចខ្ចប់ & ដឹកជញ្ជូន</h3>
                                <p className="text-[11px] sm:text-[12px] text-gray-500 font-bold leading-snug opacity-70">
                                    រៀបឥវ៉ាន់ ស្កេនកញ្ចប់ និងបញ្ជូនទៅកាន់អ្នកដឹក។
                                </p>
                            </div>
                            <div className="md:mt-6 hidden sm:flex items-center gap-2 text-amber-500 font-black text-[10px] uppercase tracking-widest">
                                <span>Fulfillment Ops</span>
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M13 7l5 5-5 5" /></svg>
                            </div>
                        </button>
                    )}

                    {/* USER/SALES ROLE */}
                    {showSales && (
                        <button 
                            onClick={() => onSelect('user_journey')}
                            className="role-btn premium-glass-mobile p-5 sm:p-8 rounded-[2rem] text-left transition-all duration-300 reveal-3 flex md:flex-col items-center md:items-start gap-5 sm:gap-0 border hover:border-emerald-500/50 group"
                        >
                            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-emerald-500 to-cyan-600 rounded-2xl flex items-center justify-center text-white sm:mb-6 transition-all shadow-xl flex-shrink-0 group-hover:scale-110">
                                <svg className="w-7 h-7 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                                    <path d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                                </svg>
                            </div>
                            <div className="flex-grow min-w-0">
                                <h3 className="text-lg sm:text-xl font-black text-white uppercase tracking-tight mb-1">ប្រតិបត្តិការលក់</h3>
                                <p className="text-[11px] sm:text-[12px] text-gray-500 font-bold leading-snug opacity-70">
                                    បង្កើតកម្មង់ ពិនិត្យប្រវត្តិលក់ និងទិន្នន័យ។
                                </p>
                            </div>
                            <div className="md:mt-6 hidden sm:flex items-center gap-2 text-emerald-500 font-black text-[10px] uppercase tracking-widest">
                                <span>Sales Portal</span>
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M13 7l5 5-5 5" /></svg>
                            </div>
                        </button>
                    )}
                </div>

                {/* Brand Footer */}
                <div className="mt-10 sm:mt-20 text-center reveal-3" style={{ animationDelay: '0.8s' }}>
                    <div className="inline-flex items-center gap-3 bg-white/5 px-4 py-2 rounded-full border border-white/5 opacity-40 hover:opacity-100 transition-opacity duration-500">
                        <img src={convertGoogleDriveUrl(APP_LOGO_URL)} alt="Logo" className="w-5 h-5 object-contain" />
                        <div className="h-3 w-px bg-white/20"></div>
                        <p className="text-[8px] sm:text-[10px] text-white font-black uppercase tracking-[0.3em]">O-System V2.0.2</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RoleSelectionPage;