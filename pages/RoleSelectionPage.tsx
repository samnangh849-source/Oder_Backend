
import React, { useContext, useEffect, useState } from 'react';
import { AppContext } from '../context/AppContext';
import UserAvatar from '../components/common/UserAvatar';
import { convertGoogleDriveUrl } from '../utils/fileUtils';
import { APP_LOGO_URL } from '../constants';

interface RoleSelectionPageProps {
    onSelect: (role: 'admin_dashboard' | 'user_journey' | 'fulfillment') => void;
}

const RoleSelectionPage: React.FC<RoleSelectionPageProps> = ({ onSelect }) => {
    const { currentUser, hasPermission, logout } = useContext(AppContext);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!currentUser) return null;

    // Robust Role Checking
    const userRoles = (currentUser.Role || '').split(',').map(r => r.trim().toLowerCase());
    const isInternalAdmin = currentUser.IsSystemAdmin || userRoles.includes('admin');
    
    const showAdmin = isInternalAdmin;
    const showFulfillment = hasPermission('access_fulfillment');
    const showSales = hasPermission('access_sales_portal');

    const visibleCount = (showAdmin ? 1 : 0) + (showFulfillment ? 1 : 0) + (showSales ? 1 : 0);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-8 bg-[#020617] relative overflow-hidden">
            {/* Background Decorative Blobs */}
            <div className="absolute top-[-10%] left-[-10%] w-[400px] sm:w-[600px] h-[400px] sm:h-[600px] bg-blue-600/10 rounded-full blur-[100px] sm:blur-[150px] animate-pulse pointer-events-none"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[400px] sm:w-[600px] h-[400px] sm:h-[600px] bg-indigo-600/10 rounded-full blur-[100px] sm:blur-[150px] animate-pulse pointer-events-none" style={{ animationDelay: '2s' }}></div>

            {/* Logout Button (Floating Top Right) */}
            <div className="absolute top-6 right-6 z-50">
                <button 
                    onClick={logout}
                    className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/20 rounded-xl text-gray-400 hover:text-red-400 transition-all active:scale-95 text-[10px] font-black uppercase tracking-widest"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" strokeWidth={2.5} /></svg>
                    <span>ចាកចេញ</span>
                </button>
            </div>

            <style>{`
                @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-10px); } }
                .animate-float { animation: float 4s ease-in-out infinite; }
                @keyframes reveal { from { opacity: 0; transform: scale(0.95) translateY(30px); filter: blur(10px); } to { opacity: 1; transform: scale(1) translateY(0); filter: blur(0); } }
                .reveal-card { animation: reveal 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; opacity: 0; }
                .premium-glass { background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(25px); border: 1px solid rgba(255, 255, 255, 0.08); box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); }
            `}</style>

            <div className="w-full max-w-6xl z-10 space-y-12 sm:space-y-20">
                {/* Profile Section */}
                <div className="text-center">
                    <div className="relative inline-block mb-8">
                        <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-3xl animate-pulse"></div>
                        <UserAvatar 
                            avatarUrl={currentUser.ProfilePictureURL} 
                            name={currentUser.FullName} 
                            size="xl"
                            className="w-28 h-24 sm:w-40 sm:h-40 border-[6px] border-gray-950 shadow-2xl relative z-10 ring-1 ring-white/20"
                        />
                        <div className="absolute -bottom-1 -right-1 w-8 h-8 sm:w-12 sm:h-12 bg-blue-600 rounded-xl sm:rounded-2xl flex items-center justify-center border-4 border-gray-950 shadow-xl text-white z-20 animate-float">
                            <svg className="w-4 h-4 sm:w-7 sm:h-7" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                        </div>
                    </div>
                    
                    <div className="reveal-card" style={{ animationDelay: '0.2s' }}>
                        <h2 className="text-blue-500 font-black uppercase tracking-[0.4em] text-[10px] mb-4">Verification Successful</h2>
                        <h1 className="text-4xl sm:text-7xl font-black text-white tracking-tighter mb-4 italic">
                            សួស្តី, <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-500">{currentUser.FullName.split(' ')[0]}</span>
                        </h1>
                        <p className="text-gray-500 text-sm sm:text-xl font-bold max-w-md mx-auto opacity-80">
                            សូមជ្រើសរើសផ្នែកដែលអ្នកចង់ចូលប្រើប្រាស់
                        </p>
                    </div>
                </div>

                {/* Grid Layout - Optimized for all screens */}
                <div className={`grid grid-cols-1 ${visibleCount >= 2 ? 'lg:grid-cols-' + visibleCount : ''} gap-6 sm:gap-10 px-4 max-w-6xl mx-auto`}>
                    {showAdmin && (
                        <button 
                            onClick={() => onSelect('admin_dashboard')}
                            className="reveal-card premium-glass group p-6 sm:p-10 rounded-[2.5rem] text-left transition-all duration-500 border border-white/5 hover:border-blue-500/40 hover:bg-blue-600/5"
                            style={{ animationDelay: '0.4s' }}
                        >
                            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl flex items-center justify-center text-white mb-8 shadow-2xl group-hover:scale-110 transition-transform duration-500">
                                <svg className="w-8 h-8 sm:w-10 sm:h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                                    <path d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                                </svg>
                            </div>
                            <h3 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight mb-2">គ្រប់គ្រងប្រព័ន្ធ</h3>
                            <p className="text-xs sm:text-sm text-gray-500 font-bold leading-relaxed opacity-70 group-hover:opacity-100 transition-opacity">
                                គ្រប់គ្រងការលក់ សិទ្ធិប្រើប្រាស់ និងពិនិត្យរបាយការណ៍សរុប។
                            </p>
                            <div className="mt-8 flex items-center gap-2 text-blue-500 font-black text-[10px] uppercase tracking-widest">
                                <span>Enter Dashboard</span>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M13 7l5 5-5 5" /></svg>
                            </div>
                        </button>
                    )}

                    {showFulfillment && (
                        <button 
                            onClick={() => onSelect('fulfillment')}
                            className="reveal-card premium-glass group p-6 sm:p-10 rounded-[2.5rem] text-left transition-all duration-500 border border-white/5 hover:border-amber-500/40 hover:bg-amber-600/5"
                            style={{ animationDelay: '0.5s' }}
                        >
                            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-amber-500 to-orange-600 rounded-3xl flex items-center justify-center text-white mb-8 shadow-2xl group-hover:scale-110 transition-transform duration-500">
                                <svg className="w-8 h-8 sm:w-10 sm:h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                                    <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                </svg>
                            </div>
                            <h3 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight mb-2">វេចខ្ចប់ & ដឹកជញ្ជូន</h3>
                            <p className="text-xs sm:text-sm text-gray-500 font-bold leading-relaxed opacity-70 group-hover:opacity-100 transition-opacity">
                                រៀបចំទំនិញតាមហាង ស្កេនបាកូដ និងបញ្ជូនឥវ៉ាន់ទៅកាន់អតិថិជន។
                            </p>
                            <div className="mt-8 flex items-center gap-2 text-amber-500 font-black text-[10px] uppercase tracking-widest">
                                <span>Fulfillment Ops</span>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M13 7l5 5-5 5" /></svg>
                            </div>
                        </button>
                    )}

                    {showSales && (
                        <button 
                            onClick={() => onSelect('user_journey')}
                            className="reveal-card premium-glass group p-6 sm:p-10 rounded-[2.5rem] text-left transition-all duration-500 border border-white/5 hover:border-emerald-500/40 hover:bg-emerald-600/5"
                            style={{ animationDelay: '0.6s' }}
                        >
                            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-emerald-500 to-cyan-600 rounded-3xl flex items-center justify-center text-white mb-8 shadow-2xl group-hover:scale-110 transition-transform duration-500">
                                <svg className="w-8 h-8 sm:w-10 sm:h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                                    <path d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                                </svg>
                            </div>
                            <h3 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight mb-2">ប្រតិបត្តិការលក់</h3>
                            <p className="text-xs sm:text-sm text-gray-500 font-bold leading-relaxed opacity-70 group-hover:opacity-100 transition-opacity">
                                បង្កើតការកម្មង់ថ្មីៗ ពិនិត្យបញ្ជីលក់ និងតាមដានស្ថានភាពដឹកជញ្ជូន។
                            </p>
                            <div className="mt-8 flex items-center gap-2 text-emerald-500 font-black text-[10px] uppercase tracking-widest">
                                <span>Sales Portal</span>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M13 7l5 5-5 5" /></svg>
                            </div>
                        </button>
                    )}
                </div>

                {/* Footer Info */}
                {!visibleCount && (
                    <div className="text-center p-8 bg-red-500/5 border border-red-500/10 rounded-3xl max-w-md mx-auto reveal-card">
                        <p className="text-red-400 font-bold text-sm">អ្នកមិនទាន់មានសិទ្ធិចូលប្រើផ្នែកណាមួយឡើយ។ សូមទាក់ទង Admin។</p>
                    </div>
                )}

                <div className="text-center pt-10 reveal-card" style={{ animationDelay: '1s' }}>
                    <div className="inline-flex items-center gap-3 bg-white/5 px-5 py-2.5 rounded-full border border-white/5 opacity-40">
                        <img src={convertGoogleDriveUrl(APP_LOGO_URL)} alt="Logo" className="w-5 h-5" />
                        <p className="text-[10px] text-white font-black uppercase tracking-[0.3em]">O-System Engine V2.0</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RoleSelectionPage;
