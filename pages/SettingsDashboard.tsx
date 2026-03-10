
import React, { useState, useContext, useEffect, useMemo } from 'react';
import { AppContext } from '../context/AppContext';
import { WEB_APP_URL } from '../constants';
import { convertGoogleDriveUrl } from '../utils/fileUtils';
import PagesPdfExportModal from '../components/admin/PagesPdfExportModal';
import { 
    configSections, 
    ConfigSection, 
    getValueCaseInsensitive, 
    getArrayCaseInsensitive 
} from '../constants/settingsConfig';
import ConfigEditModal from '../components/admin/settings/ConfigEditModal';
import SystemUpdateModal from '../components/admin/settings/SystemUpdateModal';
import TelegramTemplateManager from '../components/admin/settings/TelegramTemplateManager';
import DatabaseManagement from '../components/admin/settings/DatabaseManagement';
import PermissionManagement from '../components/admin/settings/PermissionManagement';

interface SettingsDashboardProps {
    onBack: () => void;
    initialSection?: string;
}

const SettingsDashboard: React.FC<SettingsDashboardProps> = ({ onBack, initialSection }) => {
    const { appData, refreshData, logout, setMobilePageTitle, language } = useContext(AppContext);
    const [desktopSection, setDesktopSection] = useState<string>(initialSection || 'users');
    const [mobileSection, setMobileSection] = useState<string | null>(initialSection || null);
    const [modal, setModal] = useState<{ isOpen: boolean, sectionId: string, item: any | null }>({ isOpen: false, sectionId: '', item: null });
    const [localUsers, setLocalUsers] = useState<any[]>([]);
    const [isPdfOpen, setIsPdfOpen] = useState(false);
    
    // System Update State
    const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
    const [isUpdatingSystem, setIsUpdatingSystem] = useState(false);

    const activeId = (window.innerWidth < 768) ? mobileSection : desktopSection;
    const activeSection = configSections.find(s => s.id === activeId);

    // Update Mobile Header Title
    useEffect(() => {
        const title = activeSection ? activeSection.title : 'ការកំណត់';
        setMobilePageTitle(title);
        return () => setMobilePageTitle(null);
    }, [activeSection, setMobilePageTitle]);

    useEffect(() => {
        if (activeId === 'users') {
            const fetchUsers = async () => {
                const appUsers = getArrayCaseInsensitive(appData, 'users');
                if (appUsers.length === 0) {
                    const res = await fetch(`${WEB_APP_URL}/api/users`);
                    const json = await res.json();
                    if (json.status === 'success') setLocalUsers(json.data || []);
                }
            };
            fetchUsers();
        }
    }, [activeId, appData]);

    const dataList = useMemo(() => {
        if (!activeSection) return [];
        if (activeSection.id === 'users') {
            const au = getArrayCaseInsensitive(appData, 'users');
            return au.length > 0 ? au : localUsers;
        }
        return getArrayCaseInsensitive(appData, activeSection.dataKey);
    }, [activeSection, appData, localUsers]);

    const handleDelete = async (section: ConfigSection, item: any) => {
        if (!window.confirm(`តើអ្នកប្រាកដទេថាចង់លុប "${getValueCaseInsensitive(item, section.displayField)}"?`)) return;
        try {
            await fetch(`${WEB_APP_URL}/api/admin/delete-row`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sheetName: section.sheetName, primaryKey: { [section.primaryKeyField]: getValueCaseInsensitive(item, section.primaryKeyField) } })
            });
            await refreshData();
        } catch (err) { alert('Delete failed'); }
    };

    const handleSystemUpdate = async (message: string) => {
        setIsUpdatingSystem(true);
        try {
            // Update a 'Settings' sheet to trigger logout for everyone
            await fetch(`${WEB_APP_URL}/api/admin/update-sheet`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sheetName: 'Settings', 
                    primaryKey: { 'Key': 'SystemVersion' },
                    newData: {
                        'Value': Date.now().toString(),
                        'Action': 'ForceLogout',
                        'Message': message || 'System Update in progress. Please log in again.'
                    } 
                })
            });
            
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            logout();
            window.location.reload();
        } catch (err) {
            console.error(err);
            setIsUpdatingSystem(false);
            alert("Update command failed. Check connection.");
        }
    };

    // Mobile Categories View
    if (!activeId) {
        return (
            <div className="p-4 md:hidden animate-fade-in pb-10">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="hidden text-2xl font-black text-white">ការកំណត់</h1>
                        <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">Settings & Management</p>
                    </div>
                    <button onClick={onBack} className="p-2 bg-gray-800 text-gray-400 rounded-xl border border-gray-700 active:scale-95 transition-all"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg></button>
                </div>
                <div className="grid grid-cols-1 gap-3">
                    {configSections.map(s => (
                        <button key={s.id} onClick={() => setMobileSection(s.id)} className="flex items-center gap-4 bg-gray-800/40 border border-gray-700/50 p-4 rounded-2xl hover:bg-gray-700/40 active:scale-[0.98] transition-all text-left">
                            <span className="text-3xl bg-gray-800 p-3 rounded-xl shadow-inner border border-gray-700">{s.icon}</span>
                            <div className="flex-grow">
                                <h3 className="text-base font-black text-white leading-tight">{s.title}</h3>
                                <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{s.description}</p>
                            </div>
                            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    // Desktop/Tablet Sidebar + Detail View
    return (
        <div className="w-full max-w-[100rem] mx-auto p-4 lg:p-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                <div className="flex items-center gap-4">
                    <button onClick={() => { if(window.innerWidth < 768) setMobileSection(null); else onBack(); }} className="md:hidden p-2 bg-gray-800 text-white rounded-xl border border-gray-700"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg></button>
                    <div>
                        <h1 className="hidden sm:flex text-2xl lg:text-3xl font-black text-white items-center gap-3">
                             <span className="hidden md:inline">{activeSection?.icon}</span>
                             {activeSection?.title}
                        </h1>
                        <p className="text-xs lg:text-sm text-gray-500 font-bold uppercase tracking-[0.2em] mt-1">{activeSection?.description}</p>
                    </div>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    {/* Update Version Button */}
                    <button 
                        onClick={() => setIsUpdateModalOpen(true)} 
                        className="flex-1 sm:flex-none btn bg-gray-800 border border-gray-700 hover:border-red-500/50 hover:bg-red-900/10 hover:text-red-400 text-gray-400 px-4 transition-all flex items-center justify-center gap-2"
                        title="Update Version & Force Logout"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        <span className="hidden xl:inline text-xs font-bold uppercase tracking-wider">Update Version</span>
                    </button>

                    {activeId === 'pages' && <button onClick={() => setIsPdfOpen(true)} className="flex-1 sm:flex-none btn btn-secondary px-6">PDF Export</button>}
                    {activeId !== 'telegramTemplates' && (
                        <button onClick={() => setModal({ isOpen: true, sectionId: activeId, item: null })} className="flex-1 sm:flex-none btn btn-primary px-10 shadow-lg shadow-blue-600/20 font-black">+ បន្ថែមថ្មី</button>
                    )}
                    <button onClick={onBack} className="hidden md:flex btn btn-secondary px-6">ត្រឡប់</button>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-6">
                {/* Desktop Sidebar */}
                <aside className="hidden md:flex flex-col gap-2 w-72 flex-shrink-0">
                    {configSections.map(s => (
                        <button key={s.id} onClick={() => setDesktopSection(s.id)} className={`flex items-center gap-4 p-4 rounded-2xl transition-all ${desktopSection === s.id ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'}`}>
                            <span className="text-xl">{s.icon}</span>
                            <span className="font-black text-sm uppercase tracking-wider">{s.title}</span>
                        </button>
                    ))}
                </aside>

                {/* Content Area */}
                <main className="flex-grow min-w-0">
                    {activeId === 'telegramTemplates' ? (
                        <div className="bg-gray-800/30 border border-gray-700/50 rounded-[3rem] p-8 shadow-2xl backdrop-blur-md">
                            <TelegramTemplateManager language={language} />
                        </div>
                    ) : activeId === 'database' ? (
                        <DatabaseManagement />
                    ) : activeId === 'permissions' ? (
                        <PermissionManagement />
                    ) : (
                        <div className="bg-gray-800/30 border border-gray-700/50 rounded-3xl overflow-hidden shadow-2xl">
                            {/* Desktop Table View */}
                            <div className="hidden md:block overflow-x-auto custom-scrollbar">
                                <table className="admin-table w-full">
                                    <thead>
                                        <tr className="bg-gray-900/50 border-b border-gray-700">
                                            <th className="w-12 text-center">#</th>
                                            {activeSection?.fields.map(f => <th key={f.name}>{f.label}</th>)}
                                            <th className="w-32 text-center uppercase tracking-widest text-[10px]">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-700/30">
                                        {dataList.length > 0 ? dataList.map((item: any, idx: number) => (
                                            <tr key={idx} className="hover:bg-blue-600/5 transition-colors group">
                                                <td className="text-center text-gray-500 font-bold text-xs">{idx + 1}</td>
                                                {activeSection?.fields.map(f => {
                                                    const val = getValueCaseInsensitive(item, f.name);
                                                    return (
                                                        <td key={f.name} className="py-4">
                                                            {f.type === 'image_url' && val ? (
                                                                <img src={convertGoogleDriveUrl(String(val))} className="w-10 h-10 rounded-xl object-contain bg-gray-900 border border-gray-700 p-1" alt="logo" />
                                                            ) : (
                                                                <span className={`text-sm font-bold ${f.type === 'password' ? 'text-gray-600' : 'text-gray-200'}`}>
                                                                    {f.type === 'password' ? '••••••••' : (typeof val === 'boolean' ? (val ? '✅ Active' : '❌ Inactive') : String(val || '-'))}
                                                                </span>
                                                            )}
                                                        </td>
                                                    );
                                                })}
                                                <td className="px-4 py-4 text-center">
                                                    <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => setModal({ isOpen: true, sectionId: activeId, item })} className="p-2 bg-amber-500/10 text-amber-400 rounded-lg hover:bg-amber-500 hover:text-white transition-all"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                                                        <button onClick={() => handleDelete(activeSection!, item)} className="p-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500 hover:text-white transition-all"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr><td colSpan={10} className="py-20 text-center text-gray-500 font-bold">មិនមានទិន្នន័យត្រូវបានរកឃើញទេ</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile List View */}
                            <div className="md:hidden divide-y divide-gray-700/50">
                                {dataList.length > 0 ? dataList.map((item: any, idx: number) => {
                                    const title = getValueCaseInsensitive(item, activeSection?.displayField || '');
                                    const imgField = activeSection?.fields.find(f => f.type === 'image_url');
                                    const imgVal = imgField ? getValueCaseInsensitive(item, imgField.name) : null;

                                    return (
                                        <div key={idx} className="p-4 flex items-center justify-between">
                                            <div className="flex items-center gap-3 min-w-0">
                                                {imgVal && <img src={convertGoogleDriveUrl(imgVal)} className="w-12 h-12 rounded-xl object-contain bg-gray-900 border border-gray-700 p-1 flex-shrink-0" alt="logo" />}
                                                <div className="min-w-0">
                                                    <h4 className="text-sm font-black text-white truncate">{String(title || '-')}</h4>
                                                    <p className="text-[10px] text-gray-500 font-bold uppercase mt-0.5">Item #{idx + 1}</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => setModal({ isOpen: true, sectionId: activeId, item })} className="p-2.5 bg-gray-800 text-blue-400 rounded-xl border border-gray-700 active:scale-95 transition-all"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                                                <button onClick={() => handleDelete(activeSection!, item)} className="p-2.5 bg-gray-800 text-red-400 rounded-xl border border-gray-700 active:scale-95 transition-all"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                                            </div>
                                        </div>
                                    );
                                }) : (
                                    <div className="py-20 text-center text-gray-500 font-bold">មិនមានទិន្នន័យ</div>
                                )}
                            </div>
                        </div>
                    )}
                </main>
            </div>

            {/* Floating Action Button (Mobile Only) */}
            {activeId !== 'telegramTemplates' && (
                <button 
                    onClick={() => setModal({ isOpen: true, sectionId: activeId, item: null })}
                    className="md:hidden fixed bottom-24 right-6 w-16 h-16 bg-blue-600 text-white rounded-full shadow-2xl flex items-center justify-center active:scale-90 transition-transform z-40 border-4 border-gray-900"
                >
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                </button>
            )}

            {modal.isOpen && activeSection && (
                <ConfigEditModal 
                    section={activeSection}
                    item={modal.item}
                    onClose={() => setModal({ ...modal, isOpen: false })}
                    onSave={() => { setModal({ ...modal, isOpen: false }); refreshData(); }}
                />
            )}

            <SystemUpdateModal 
                isOpen={isUpdateModalOpen}
                onClose={() => setIsUpdateModalOpen(false)}
                onConfirm={handleSystemUpdate}
                isProcessing={isUpdatingSystem}
            />

            {isPdfOpen && (
                <PagesPdfExportModal 
                    isOpen={isPdfOpen} 
                    onClose={() => setIsPdfOpen(false)}
                    pages={getArrayCaseInsensitive(appData, 'pages')}
                />
            )}
        </div>
    );
};

export default SettingsDashboard;
