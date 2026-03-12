
import React, { useState, useContext, useRef } from 'react';
import { AppContext } from '../../context/AppContext';
import Modal from './Modal';
import Spinner from './Spinner';
import { WEB_APP_URL } from '../../constants';
import { compressImage } from '../../utils/imageCompressor';
import { fileToBase64, convertGoogleDriveUrl } from '../../utils/fileUtils';

interface EditProfileModalProps {
    onClose: () => void;
}

const EditProfileModal: React.FC<EditProfileModalProps> = ({ onClose }) => {
    const { currentUser, refreshData, updateCurrentUser } = useContext(AppContext);
    const [activeTab, setActiveTab] = useState<'general' | 'security'>('general');
    
    // General State
    const [fullName, setFullName] = useState(currentUser?.FullName || '');
    const [profilePicUrl, setProfilePicUrl] = useState(currentUser?.ProfilePictureURL || '');
    
    // Security State
    const [oldPassword, setOldPassword] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isOldPasswordVisible, setIsOldPasswordVisible] = useState(false);
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);

    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [loading, setLoading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImageUpload = async (file: File) => {
        if (!file) return;
        setIsUploading(true);
        setError('');
        try {
            const compressedBlob = await compressImage(file, 0.8, 1024);
            const base64Data = await fileToBase64(compressedBlob);
            const payload = {
                fileData: base64Data,
                fileName: file.name,
                mimeType: compressedBlob.type,
                userName: currentUser?.UserName || 'unknown'
            };
            const response = await fetch(`${WEB_APP_URL}/api/upload-image`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (!response.ok || result.status !== 'success') {
                throw new Error(result.message || 'Image upload failed');
            }
            setProfilePicUrl(result.url);
        } catch (err) {
            console.error(err);
            setError((err as Error).message);
        } finally {
            setIsUploading(false);
        }
    };

    const handleGeneralSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');
        setLoading(true);

        try {
            const profilePayload = {
                userName: currentUser?.UserName,
                fullName: fullName,
                profilePictureURL: profilePicUrl
            };

            const response = await fetch(`${WEB_APP_URL}/api/profile/update`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(profilePayload)
            });

            const result = await response.json();
            if (!response.ok || result.status !== 'success') {
                throw new Error(result.message || 'Failed to update profile.');
            }

            updateCurrentUser({
                FullName: fullName,
                ProfilePictureURL: profilePicUrl,
            });
            await refreshData();
            setSuccessMsg('ព័ត៌មានផ្ទាល់ខ្លួនត្រូវបានកែប្រែជោគជ័យ!');
            setTimeout(onClose, 1500);

        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSecuritySubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');
        setLoading(true);

        if (!oldPassword) {
            setError('សូមបញ្ចូលពាក្យសម្ងាត់បច្ចុប្បន្នរបស់អ្នក។');
            setLoading(false);
            return;
        }
        if (!password) {
            setError('សូមបញ្ចូលពាក្យសម្ងាត់ថ្មី។');
            setLoading(false);
            return;
        }
        if (password.length < 6) {
            setError('ពាក្យសម្ងាត់ថ្មីត្រូវមានយ៉ាងតិច ៦ តួអក្សរ។');
            setLoading(false);
            return;
        }
        if (password !== confirmPassword) {
            setError('ពាក្យសម្ងាត់ថ្មី និងការបញ្ជាក់មិនត្រូវគ្នាទេ។');
            setLoading(false);
            return;
        }

        try {
            const passwordPayload = {
                userName: currentUser?.UserName,
                oldPassword: oldPassword,
                newPassword: password,
            };
            const response = await fetch(`${WEB_APP_URL}/api/profile/change-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(passwordPayload)
            });
            const result = await response.json();
            
            if (!response.ok || result.status !== 'success') {
                throw new Error(result.message || 'Failed to change password.');
            }

            setSuccessMsg('ពាក្យសម្ងាត់ត្រូវបានផ្លាស់ប្តូរជោគជ័យ!');
            setOldPassword('');
            setPassword('');
            setConfirmPassword('');
            setTimeout(onClose, 1500);

        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <Modal isOpen={true} onClose={onClose} maxWidth="max-w-xl">
            <div className="p-8 flex flex-col h-full">
                <div className="flex justify-between items-center mb-8 relative z-10">
                    <div className="flex items-center gap-4">
                        <div className="w-1.5 h-8 bg-blue-600 rounded-full shadow-[0_0_15px_rgba(37,99,235,0.4)]"></div>
                        <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic leading-none">Security Center</h2>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-gray-500 hover:text-white transition-all active:scale-90 border border-white/5 hover:bg-white/10 shadow-lg">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex bg-gray-900/50 p-1.5 rounded-2xl border border-white/5 mb-8">
                    <button 
                        className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'general' ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/30' : 'text-gray-400 hover:text-gray-300'}`}
                        onClick={() => { setActiveTab('general'); setError(''); setSuccessMsg(''); }}
                    >
                        ព័ត៌មានទូទៅ
                    </button>
                    <button 
                        className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'security' ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/30' : 'text-gray-400 hover:text-gray-300'}`}
                        onClick={() => { setActiveTab('security'); setError(''); setSuccessMsg(''); }}
                    >
                        សុវត្ថិភាព
                    </button>
                </div>

                <div className="flex-grow overflow-y-auto custom-scrollbar pr-2">
                    {activeTab === 'general' ? (
                        <form onSubmit={handleGeneralSubmit} className="space-y-6">
                            <div className="flex flex-col items-center mb-8">
                                <div className="relative group">
                                    <img src={convertGoogleDriveUrl(profilePicUrl)} alt="Profile" className="w-28 h-24 rounded-3xl object-cover border-4 border-gray-800 shadow-2xl transition-transform duration-500 group-hover:scale-105" />
                                    <div className="absolute inset-0 bg-blue-600/40 backdrop-blur-sm rounded-3xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer border-2 border-blue-400/50" onClick={() => fileInputRef.current?.click()}>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white drop-shadow-lg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                    </div>
                                </div>
                                <input 
                                    type="file" 
                                    accept="image/*" 
                                    ref={fileInputRef} 
                                    onChange={(e) => e.target.files && handleImageUpload(e.target.files[0])}
                                    className="hidden"
                                />
                                <button type="button" onClick={() => fileInputRef.current?.click()} className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400 mt-4 hover:text-blue-300 transition-colors" disabled={isUploading}>
                                    {isUploading ? 'កំពុង Upload...' : 'ប្តូររូបភាព Profile'}
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest ml-2">ឈ្មោះគណនី (UserName)</label>
                                    <input type="text" value={currentUser?.UserName || ''} className="form-input bg-gray-800/50 cursor-not-allowed text-gray-500 border-dashed border-gray-700 font-mono" readOnly />
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest ml-2">ឈ្មោះពេញ (Full Name)</label>
                                    <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="form-input !py-3.5 !px-5" required />
                                </div>
                            </div>

                            {error && <p className="text-red-400 text-xs font-bold bg-red-900/20 p-4 rounded-2xl border border-red-500/20 animate-shake">{error}</p>}
                            {successMsg && <p className="text-emerald-400 text-xs font-bold bg-emerald-900/20 p-4 rounded-2xl border border-emerald-500/20 animate-fade-in">{successMsg}</p>}

                            <div className="flex justify-end pt-6 gap-4">
                                <button type="button" onClick={onClose} className="px-8 py-3 text-gray-400 hover:text-white font-black uppercase text-xs tracking-widest transition-colors">បោះបង់</button>
                                <button type="submit" className="btn btn-primary px-10 py-3 shadow-lg shadow-blue-600/20 active:scale-95 text-xs font-black uppercase tracking-widest rounded-2xl" disabled={loading || isUploading}>
                                    {loading ? <Spinner size="sm" /> : 'រក្សាទុកការផ្លាស់ប្តូរ'}
                                </button>
                            </div>
                        </form>
                    ) : (
                        <form onSubmit={handleSecuritySubmit} className="space-y-6 animate-fade-in">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest ml-2">ពាក្យសម្ងាត់បច្ចុប្បន្ន</label>
                                    <div className="relative">
                                        <input type={isOldPasswordVisible ? "text" : "password"} value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} className="form-input !py-3.5 !px-5 pr-14" />
                                        <button type="button" onClick={() => setIsOldPasswordVisible(!isOldPasswordVisible)} className="absolute inset-y-0 right-0 px-4 flex items-center text-gray-400 hover:text-white transition-colors">
                                            {isOldPasswordVisible ? (
                                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7 1.274-4.057 5.064-7 9.542-7 .847 0 1.67 .126 2.454 .364m-3.033 2.446a3 3 0 11-4.243 4.243m4.242-4.242l4.243 4.243M3 3l18 18" /></svg>
                                            ) : (
                                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                            )}
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest ml-2">ពាក្យសម្ងាត់ថ្មី</label>
                                    <div className="relative">
                                        <input type={isPasswordVisible ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="form-input !py-3.5 !px-5 pr-14" />
                                        <button type="button" onClick={() => setIsPasswordVisible(!isPasswordVisible)} className="absolute inset-y-0 right-0 px-4 flex items-center text-gray-400 hover:text-white transition-colors">
                                            {isPasswordVisible ? (
                                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7 1.274-4.057 5.064-7 9.542-7 .847 0 1.67 .126 2.454 .364m-3.033 2.446a3 3 0 11-4.243 4.243m4.242-4.242l4.243 4.243M3 3l18 18" /></svg>
                                            ) : (
                                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                            )}
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest ml-2">បញ្ជាក់ពាក្យសម្ងាត់ថ្មី</label>
                                    <input type={isConfirmPasswordVisible ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="form-input !py-3.5 !px-5" />
                                </div>
                            </div>

                            {error && <p className="text-red-400 text-xs font-bold bg-red-900/20 p-4 rounded-2xl border border-red-500/20 animate-shake">{error}</p>}
                            {successMsg && <p className="text-emerald-400 text-xs font-bold bg-emerald-900/20 p-4 rounded-2xl border border-emerald-500/20 animate-fade-in">{successMsg}</p>}

                            <div className="flex justify-end pt-6 gap-4">
                                <button type="button" onClick={onClose} className="px-8 py-3 text-gray-400 hover:text-white font-black uppercase text-xs tracking-widest transition-colors">បោះបង់</button>
                                <button type="submit" className="btn btn-primary px-10 py-3 shadow-lg shadow-blue-600/20 active:scale-95 text-xs font-black uppercase tracking-widest rounded-2xl" disabled={loading}>
                                    {loading ? <Spinner size="sm" /> : 'ផ្លាស់ប្តូរពាក្យសម្ងាត់'}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </Modal>
    );
};

export default EditProfileModal;
