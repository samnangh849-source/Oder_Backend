
import React, { useContext, useMemo } from 'react';
import { AppContext } from '../context/AppContext';
import { translations } from '../translations';
import MobileUserJourney from './MobileUserJourney';
import DesktopUserJourney from './DesktopUserJourney';

const UserJourney: React.FC<{ onBackToRoleSelect: () => void }> = ({ onBackToRoleSelect }) => {
    const { currentUser, language, hasPermission } = useContext(AppContext);
    
    const userTeams = useMemo(() => 
        (currentUser?.Team || '').split(',').map(t => t.trim()).filter(Boolean), 
    [currentUser]);
    
    const t = translations[language];

    // Responsive State
    const [isMobile, setIsMobile] = React.useState(window.innerWidth < 768);

    React.useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // 1. Permission Check
    if (!hasPermission('access_sales_portal')) {
        return (
            <div className="flex items-center justify-center min-h-full p-6 bg-[#020617]">
                <div className="text-center p-12 max-w-lg w-full bg-white/[0.02] border border-white/5 rounded-[3rem] backdrop-blur-3xl shadow-2xl animate-fade-in">
                    <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center border border-red-500/20 mb-6 mx-auto">
                        <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-4 italic uppercase tracking-tight">Access Denied</h2>
                    <p className="text-gray-500 text-sm leading-relaxed mb-10">អ្នកមិនមានសិទ្ធិចូលប្រើប្រាស់ផ្នែកនេះទេ។ សូមទាក់ទង Admin។</p>
                    <button onClick={onBackToRoleSelect} className="w-full py-4 bg-white text-black rounded-2xl font-bold uppercase text-xs tracking-widest hover:bg-gray-200 transition-colors shadow-xl">{t.back}</button>
                </div>
            </div>
        );
    }

    // 2. Team Count Check
    if (userTeams.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-full p-6 bg-[#020617]">
                <div className="text-center p-12 max-w-lg w-full bg-white/[0.02] border border-white/5 rounded-[3rem] backdrop-blur-3xl shadow-2xl animate-fade-in">
                    <h2 className="text-2xl font-bold text-white mb-4 italic uppercase">Identification Error</h2>
                    <p className="text-gray-500 text-sm leading-relaxed mb-10">គណនីរបស់អ្នកមិនទាន់មានក្រុមការងារនៅឡើយទេ។ សូមទាក់ទងរដ្ឋបាលប្រព័ន្ធ។</p>
                    <button onClick={onBackToRoleSelect} className="w-full py-4 bg-white text-black rounded-2xl font-bold uppercase text-xs tracking-widest hover:bg-gray-200 transition-colors shadow-xl">{t.back}</button>
                </div>
            </div>
        );
    }

    // 3. Render Appropriate View
    if (isMobile) {
        return <MobileUserJourney onBackToRoleSelect={onBackToRoleSelect} userTeams={userTeams} />;
    }

    return <DesktopUserJourney onBackToRoleSelect={onBackToRoleSelect} userTeams={userTeams} />;
};

export default UserJourney;
