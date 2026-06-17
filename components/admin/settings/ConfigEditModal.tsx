
import React, { useState, useContext, useRef, useEffect } from 'react';
import { AppContext } from '../../../context/AppContext';
import { ConfigSection, getValueCaseInsensitive, getArrayCaseInsensitive } from '../../../constants/settingsConfig';
import Spinner from '../../common/Spinner';
import Modal from '../../common/Modal';
import { WEB_APP_URL } from '../../../constants';
import { fileToBase64, convertGoogleDriveUrl } from '../../../utils/fileUtils';
import { CacheService, CACHE_KEYS } from '../../../services/cacheService';
import { compressImage } from '../../../utils/imageCompressor';
import { translations } from '../../../translations';
import SelectFilter from '../../orders/filters/SelectFilter';
import { removeBackground } from '@imgly/background-removal';

interface ConfigEditModalProps {
    section: ConfigSection;
    item: any | null;
    onClose: () => void;
    onSave: (item: any) => void;
}

const ConfigEditModal: React.FC<ConfigEditModalProps> = ({ section, item, onClose, onSave }) => {
    const { refreshData, appData, language } = useContext(AppContext);
    const t = translations[language];
    const [formData, setFormData] = useState<any>({}); 
    const [uploadingFields, setUploadingFields] = useState<Record<string, boolean>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
    const [passwordVisibility, setPasswordVisibility] = useState<Record<string, boolean>>({});

    // Cropping State
    const [cropModal, setCropModal] = useState<{ isOpen: boolean; fieldName: string; src: string | null; fileName: string }>({
        isOpen: false,
        fieldName: '',
        src: null,
        fileName: ''
    });

    useEffect(() => {
        if (item) {
            const dataToLoad: any = {};
            section.fields.forEach(field => {
                let val = getValueCaseInsensitive(item, field.name);
                if (val === undefined || val === null) {
                    val = field.type === 'checkbox' ? false : field.type === 'number' ? 0 : '';
                }
                dataToLoad[field.name] = val;
            });
            if (section.id === 'users') dataToLoad.Password = ''; 
            setFormData(dataToLoad);
        } else {
            const defaultData = section.fields.reduce((acc, field) => {
                // Special case for Role ID (Auto-suggest next ID)
                if (section.id === 'roles' && field.name === 'ID') {
                    const roles = getArrayCaseInsensitive(appData, 'roles');
                    const maxId = roles.reduce((max: number, r: any) => Math.max(max, Number(getValueCaseInsensitive(r, 'ID')) || 0), 0);
                    acc[field.name] = maxId + 1;
                } else {
                    acc[field.name] = field.type === 'checkbox' ? false : field.type === 'number' ? 0 : '';
                }
                return acc;
            }, {} as any);
            setFormData(defaultData);
        }
    }, [item, section, appData]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        const checked = (e.target as HTMLInputElement).checked;
        setFormData((prev: any) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const getOptions = (field: any) => {
        if (field.options) return field.options;
        if (field.dataRef) {
            const data = appData[field.dataRef] || [];
            if (field.dataRef === 'stores') return data.map((s: any) => ({ label: s.StoreName, value: s.StoreName }));
            if (field.dataRef === 'locations') return Array.from(new Set(data.map((l: any) => l.Province))).map(p => ({ label: p as string, value: p as string }));
            if (field.dataRef === 'drivers') return data.map((d: any) => ({ label: d.DriverName, value: d.DriverName }));
            if (field.dataRef === 'shippingMethods') return data.map((m: any) => ({ label: m.MethodName, value: m.MethodName }));
            if (field.dataRef === 'roles') return data.map((r: any) => {
                const name = getValueCaseInsensitive(r, 'RoleName') || getValueCaseInsensitive(r, 'Role');
                return { label: name, value: name };
            });
            if (field.dataRef === 'pages') {
                const teams = Array.from(new Set(data.map((p: any) => getValueCaseInsensitive(p, 'Team')))).filter(Boolean);
                return teams.map(t => ({ label: String(t), value: String(t) }));
            }
        }
        return [];
    };

    const handleImageUpload = async (fieldName: string, file: File) => {
        if (!file) return;
        
        // Validate file type
        const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            setError('សូមជ្រើសរើសប្រភេទរូបភាព PNG, JPG ឬ Webp');
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            setCropModal({
                isOpen: true,
                fieldName,
                src: reader.result as string,
                fileName: file.name
            });
        };
        reader.readAsDataURL(file);
    };

    const handleCroppedImage = async (fieldName: string, croppedBlob: Blob, fileName: string) => {
        setUploadingFields(prev => ({ ...prev, [fieldName]: true }));
        setCropModal({ isOpen: false, fieldName: '', src: null, fileName: '' });
        
        try {
            const base64Data = await fileToBase64(croppedBlob);
            const token = localStorage.getItem('token');
            
            const response = await fetch(`${WEB_APP_URL}/api/upload-image`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ 
                    fileData: base64Data, 
                    fileName: fileName, 
                    mimeType: croppedBlob.type,
                    sheetName: section.sheetName,
                    primaryKey: item ? { [section.primaryKeyField]: item[section.primaryKeyField] } : undefined,
                    targetColumn: fieldName
                })
            });
            const result = await response.json();
            if (!response.ok || result.status !== 'success') throw new Error(result.message || 'Upload failed');
            
            const finalUrl = result.url;
            setFormData((prev: any) => ({ ...prev, [fieldName]: finalUrl }));
        } catch (err: any) { 
            setError(err.message); 
        } finally { 
            setUploadingFields(prev => ({ ...prev, [fieldName]: false })); 
        }
    };
    
    // Fields that are always optional (never block save)
    const OPTIONAL_FIELDS = new Set(['Team', 'TelegramUsername', 'ProfilePictureURL', 'Description', 'TelegramTopicID']);

    const handleSave = async () => {
        setError('');
        for (const field of section.fields) {
            if (field.readOnly) continue;
            if (OPTIONAL_FIELDS.has(field.name)) continue;
            if (field.type !== 'checkbox' && (formData[field.name] === undefined || formData[field.name] === '')) {
                if (field.name === 'Password' && item) continue; // OK to leave empty when editing
                setError(`សូមបំពេញចន្លោះ "${field.label}"`);
                return;
            }
        }
        setIsLoading(true);
        try {
            let endpoint = item ? '/api/admin/update-sheet' : '/api/admin/add-row';
            
            // Special endpoints for Roles and Permissions
            if (!item) {
                if (section.id === 'roles') endpoint = '/api/admin/roles';
                else if (section.id === 'permissions') endpoint = '/api/admin/permissions';
            } else {
                if (section.id === 'permissions') endpoint = '/api/admin/permissions/update';
            }

            const payloadData = { ...formData };
            section.fields.forEach(field => { if (field.type === 'number') payloadData[field.name] = Number(payloadData[field.name]); });
            
            if (item && section.id === 'users' && !payloadData.Password) delete payloadData.Password;
            
            // For new items (except Roles which might need the ID we calculated), omit the ID field if it's auto-generated
            if (!item && section.id !== 'roles') {
                delete payloadData.id;
                delete payloadData.ID;
            }

            // Backend specific role creation expects direct Role object in body
            const payload: any = (section.id === 'roles' && !item) 
                ? payloadData 
                : { sheetName: section.sheetName, newData: payloadData };
                
            if (item) payload.primaryKey = { [section.primaryKeyField]: getValueCaseInsensitive(item, section.primaryKeyField) };
            
            const session = await CacheService.get<{ token: string }>(CACHE_KEYS.SESSION);
            const token = session?.token;
            const headers: HeadersInit = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const response = await fetch(`${WEB_APP_URL}${endpoint}`, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload)
            });
            
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || 'រក្សាទុកមិនបានជោគជ័យ');
            
            await refreshData();
            onSave(formData);
        } catch (err: any) { setError(err.message); } finally { setIsLoading(false); }
    };
    
    // ─── Shared field renderers ────────────────────────────────────────────
    const renderField = (field: any) => {
        if (field.type === 'checkbox') return (
            <button
                type="button"
                onClick={() => setFormData((prev: any) => ({ ...prev, [field.name]: !prev[field.name] }))}
                className={`relative w-12 h-6 rounded-full transition-all duration-300 flex-shrink-0 ${formData[field.name] ? 'bg-[#fcd535]' : 'bg-[#2b3139]'}`}
            >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-300 ${formData[field.name] ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
        );
        if (field.type === 'image_url') return (
            <div className="space-y-4">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                    <div className="relative flex-grow group">
                        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-gray-500 group-focus-within:text-[#fcd535] transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.826L10.242 9.172a4 4 0 015.656 0l4 4a4 4 0 01-5.656 5.656l-1.102 1.101m-.758-4.826l1.281 1.281" /></svg>
                        </div>
                        <input 
                            type="text" 
                            name={field.name} 
                            value={formData[field.name] || ''} 
                            onChange={handleChange} 
                            placeholder={field.placeholder || "Paste image URL or Upload"} 
                            className="form-input !py-3.5 !pl-11 !pr-4 text-sm w-full bg-[#0B0E11] border-[#2B3139] hover:border-[#3D4451] focus:border-[#fcd535]/50 transition-all rounded-sm" 
                        />
                    </div>
                    
                    <input 
                        type="file" 
                        accept="image/png, image/jpeg, image/webp" 
                        ref={el => { fileInputRefs.current[field.name] = el; }} 
                        onChange={(e) => e.target.files && handleImageUpload(field.name, e.target.files[0])} 
                        className="hidden" 
                    />
                    
                    <button 
                        type="button" 
                        onClick={() => fileInputRefs.current[field.name]?.click()} 
                        className="h-12 px-6 bg-[#2b3139] text-[#848e9c] rounded-sm border border-[#3d4451] hover:border-[#fcd535]/40 hover:text-[#fcd535] transition-all flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest whitespace-nowrap" 
                        disabled={uploadingFields[field.name]}
                    >
                        {uploadingFields[field.name] ? <Spinner size="sm" /> : (
                            <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h14a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                Upload Image
                            </>
                        )}
                    </button>
                </div>

                {formData[field.name] && (
                    <div className="relative group w-40 h-40">
                        <img 
                            src={convertGoogleDriveUrl(formData[field.name])} 
                            className="w-full h-full rounded-sm object-cover bg-[#0B0E11] border border-[#2b3139] shadow-2xl" 
                            alt="preview" 
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-sm backdrop-blur-[2px]">
                            <button 
                                type="button"
                                onClick={() => setFormData((prev: any) => ({ ...prev, [field.name]: '' }))}
                                className="p-2 bg-red-500/20 text-red-500 rounded-sm hover:bg-red-500 hover:text-white transition-all"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
        if (field.type === 'password') return (
            <div className="relative">
                <input type={passwordVisibility[field.name] ? 'text' : 'password'} name={field.name} value={formData[field.name] || ''} onChange={handleChange} className="form-input !py-3.5 !px-5 pr-14" placeholder={field.placeholder || (item ? 'ទុកទទេបើមិនចង់ប្តូរ' : 'បញ្ចូលពាក្យសម្ងាត់')} />
                <button type="button" onClick={() => setPasswordVisibility(prev => ({ ...prev, [field.name]: !prev[field.name] }))} className="absolute inset-y-0 right-0 px-4 text-gray-500 hover:text-white transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={passwordVisibility[field.name] ? "M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7 1.274-4.057 5.064-7 9.542-7 .847 0 1.67 .126 2.454 .364m-3.033 2.446a3 3 0 11-4.243 4.243m4.242-4.242l4.243 4.243M3 3l18 18" : "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"} /></svg></button>
            </div>
        );
        if (field.type === 'select') return field.multiple ? (
            <SelectFilter label="" value={formData[field.name] || ''} onChange={(v) => setFormData((prev: any) => ({ ...prev, [field.name]: v }))} options={getOptions(field)} placeholder="-- ជ្រើសរើស --" multiple={true} />
        ) : (
            <div className="relative">
                <select name={field.name} value={formData[field.name] || ''} onChange={handleChange} className="form-input !py-3.5 !pl-5 !pr-10 appearance-none w-full cursor-pointer">
                    <option value="">-- ជ្រើសរើស --</option>
                    {getOptions(field).map((opt: any) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg></div>
            </div>
        );
        return (
            <input type={field.type} name={field.name} value={formData[field.name] || ''} onChange={handleChange} placeholder={field.placeholder}
                className={`form-input !py-3.5 !px-5 ${field.readOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                readOnly={field.readOnly || (item && field.name === section.primaryKeyField)} />
        );
    };

    const renderLabel = (label: string) => (
        <p className="text-[10px] font-black text-[#5e6673] uppercase tracking-[0.18em] mb-1.5">{label}</p>
    );

    // ─── Shared footer ──────────────────────────────────────────────────────
    const renderFooter = () => (
        <>
            {error && <div className="mt-4 px-4 py-3 bg-red-500/10 text-red-400 border border-red-500/20 rounded-2xl text-sm font-bold">{error}</div>}
            <div className="flex justify-end gap-3 mt-5 pt-5 border-t border-[#2b3139]">
                <button type="button" onClick={onClose} className="px-6 py-2.5 text-[#848e9c] hover:text-[#eaecef] font-black text-xs uppercase tracking-widest transition-colors">{t.cancel}</button>
                <button type="button" onClick={handleSave} disabled={isLoading} className="px-8 py-2.5 bg-[#fcd535] text-black rounded-xl font-black text-xs uppercase tracking-widest hover:bg-[#f0c832] transition-all active:scale-95 disabled:opacity-60 flex items-center gap-2">
                    {isLoading ? <Spinner size="sm" /> : null}{t.save}
                </button>
            </div>
        </>
    );

    // ─── USERS: dedicated beautiful form ───────────────────────────────────
    if (section.id === 'users') {
        const avatarUrl    = formData['ProfilePictureURL'] || '';
        const fullName     = formData['FullName'] || '';
        const userName     = formData['UserName'] || '';
        const words        = fullName.trim().split(/\s+/);
        const initials     = (words.length >= 2 ? words[0][0] + words[words.length - 1][0] : fullName.slice(0, 2)).toUpperCase();
        const isAdmin      = !!formData['IsSystemAdmin'];
        const roleField    = section.fields.find(f => f.name === 'Role')!;
        const teamField    = section.fields.find(f => f.name === 'Team')!;
        const telegramField = section.fields.find(f => f.name === 'TelegramUsername');

        return (
            <Modal isOpen={true} onClose={onClose} maxWidth="max-w-[520px]">
                <div className="flex flex-col" style={{ maxHeight: '90vh' }}>

                    {/* ── Header ── */}
                    <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[#2b3139] flex-shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="w-1 h-6 bg-[#fcd535] rounded-full" />
                            <div>
                                <h2 className="text-base font-black text-[#eaecef] uppercase tracking-wider">
                                    {item ? 'កែសម្រួល' : 'បន្ថែម'} អ្នកប្រើប្រាស់
                                </h2>
                                {item && <p className="text-[11px] text-[#5e6673] font-bold mt-0.5">@{userName}</p>}
                            </div>
                        </div>
                        <button onClick={onClose} className="w-8 h-8 rounded-xl bg-[#2b3139] text-[#848e9c] hover:text-[#eaecef] transition-all flex items-center justify-center active:scale-90">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>

                    {/* ── Scrollable body ── */}
                    <div className="overflow-y-auto no-scrollbar flex-grow px-6 py-5 space-y-5">

                        {/* Avatar upload row */}
                        <div className="flex items-center gap-5">
                            {/* Avatar */}
                            <div className="relative flex-shrink-0 group">
                                <div className="w-20 h-20 rounded-2xl overflow-hidden bg-gradient-to-br from-blue-500 to-purple-600 border-2 border-[#2b3139]">
                                    {avatarUrl
                                        ? <img src={convertGoogleDriveUrl(avatarUrl)} className="w-full h-full object-cover" alt="avatar" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                        : <div className="w-full h-full flex items-center justify-center text-white text-2xl font-black select-none">{initials || '?'}</div>
                                    }
                                </div>
                                <button
                                    type="button"
                                    onClick={() => fileInputRefs.current['ProfilePictureURL']?.click()}
                                    disabled={uploadingFields['ProfilePictureURL']}
                                    className="absolute -bottom-1.5 -right-1.5 w-7 h-7 bg-[#fcd535] text-black rounded-lg flex items-center justify-center shadow-lg hover:bg-[#f0c832] transition-all active:scale-90"
                                >
                                    {uploadingFields['ProfilePictureURL']
                                        ? <Spinner size="sm" />
                                        : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                    }
                                </button>
                                <input type="file" accept="image/*" ref={el => { fileInputRefs.current['ProfilePictureURL'] = el; }} onChange={(e) => e.target.files && handleImageUpload('ProfilePictureURL', e.target.files[0])} className="hidden" />
                            </div>
                            {/* Name/username overview */}
                            <div className="flex-grow min-w-0">
                                <p className="text-[#eaecef] font-black text-base truncate">{fullName || 'ឈ្មោះពេញ'}</p>
                                <p className="text-[#5e6673] font-mono text-sm mt-0.5">@{userName || 'username'}</p>
                                <p className="text-[10px] text-[#5e6673] mt-2 font-bold">ចុចប្រអប់ 📷 ដើម្បីប្តូររូបភាព</p>
                            </div>
                        </div>

                        {/* Full Name + Username (2-col) */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                {renderLabel('ឈ្មោះពេញ')}
                                <input type="text" name="FullName" value={formData['FullName'] || ''} onChange={handleChange} placeholder="ឧ. Chan Dara" className="form-input !py-3 !px-4 text-sm w-full" />
                            </div>
                            <div>
                                {renderLabel('Username (Login)')}
                                <input type="text" name="UserName" value={formData['UserName'] || ''} onChange={handleChange} placeholder="ឧ. chandara" className={`form-input !py-3 !px-4 text-sm w-full font-mono ${item ? 'opacity-60 cursor-not-allowed' : ''}`} readOnly={!!item} />
                            </div>
                        </div>

                        {/* Password */}
                        <div>
                            {renderLabel('ពាក្យសម្ងាត់')}
                            <div className="relative">
                                <input
                                    type={passwordVisibility['Password'] ? 'text' : 'password'}
                                    name="Password"
                                    value={formData['Password'] || ''}
                                    onChange={handleChange}
                                    className="form-input !py-3 !px-4 pr-12 text-sm w-full"
                                    placeholder={item ? 'ទុកទទេបើមិនចង់ប្តូរ' : 'បញ្ចូលពាក្យសម្ងាត់'}
                                />
                                <button type="button" onClick={() => setPasswordVisibility(prev => ({ ...prev, Password: !prev['Password'] }))} className="absolute inset-y-0 right-0 px-3.5 text-[#5e6673] hover:text-[#eaecef] transition-colors">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={passwordVisibility['Password'] ? "M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7 1.274-4.057 5.064-7 9.542-7 .847 0 1.67 .126 2.454 .364m-3.033 2.446a3 3 0 11-4.243 4.243m4.242-4.242l4.243 4.243M3 3l18 18" : "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"} /></svg>
                                </button>
                            </div>
                            {item && <p className="text-[10px] text-[#5e6673] font-bold mt-1.5 ml-1">ទុកទទេ = រក្សាពាក្យសម្ងាត់ចាស់</p>}
                        </div>

                        {/* Role + Team (2-col) */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                {renderLabel('តួនាទី (Role)')}
                                <SelectFilter label="" value={formData['Role'] || ''} onChange={(v) => setFormData((prev: any) => ({ ...prev, Role: v }))} options={getOptions(roleField)} placeholder="-- ជ្រើសរើស --" multiple={true} variant="modal" />
                            </div>
                            <div>
                                {renderLabel('ក្រុម (Team) — ស្រេចចិត្ត')}
                                <SelectFilter label="" value={formData['Team'] || ''} onChange={(v) => setFormData((prev: any) => ({ ...prev, Team: v }))} options={getOptions(teamField)} placeholder="-- ជ្រើសរើស --" multiple={true} variant="modal" />
                            </div>
                        </div>

                        {/* Telegram */}
                        {telegramField && (
                            <div>
                                {renderLabel('Telegram Username — ស្រេចចិត្ត')}
                                <div className="flex items-center bg-[#1e2329] border border-[#2b3139] rounded-xl overflow-hidden focus-within:border-[#fcd535]/40 transition-colors">
                                    <span className="pl-4 pr-2 text-[#5e6673] font-black text-sm select-none flex-shrink-0">@</span>
                                    <input type="text" name="TelegramUsername" value={formData['TelegramUsername'] || ''} onChange={handleChange} placeholder="john_doe" className="flex-grow py-3 pr-4 bg-transparent text-sm font-mono text-[#eaecef] placeholder:text-[#5e6673] outline-none" />
                                </div>
                            </div>
                        )}

                        {/* System Admin toggle */}
                        <div className="flex items-center justify-between bg-[#1e2329] border border-[#2b3139] rounded-2xl px-4 py-3.5">
                            <div>
                                <p className="text-sm font-black text-[#eaecef]">System Admin</p>
                                <p className="text-[11px] text-[#5e6673] font-bold mt-0.5">អ្នកប្រើប្រាស់នេះមានសិទ្ធិគ្រប់គ្រងពេញលេញ</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setFormData((prev: any) => ({ ...prev, IsSystemAdmin: !prev.IsSystemAdmin }))}
                                className={`relative w-12 h-6 rounded-full transition-all duration-300 flex-shrink-0 ${isAdmin ? 'bg-[#fcd535]' : 'bg-[#2b3139]'}`}
                            >
                                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-300 ${isAdmin ? 'translate-x-6' : 'translate-x-0'}`} />
                            </button>
                        </div>

                    </div>

                    {/* ── Footer ── */}
                    <div className="px-6 pb-6 flex-shrink-0">
                        {renderFooter()}
                    </div>

                </div>
            </Modal>
        );
    }

    // ─── GENERIC form (all other sections) ─────────────────────────────────
    const isProductSection = section.id === 'products';

    return (
        <Modal isOpen={true} onClose={onClose} maxWidth={isProductSection ? "" : "max-w-2xl"} fullScreen={isProductSection}>
            <div className={`flex flex-col h-full ${isProductSection ? 'bg-[#0B0E11]' : 'p-8'}`}>
                {isProductSection ? (
                    // ── Full Screen Header for Products ──
                    <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-[#2b3139] bg-[#181A20]">
                        <div className="flex items-center gap-3">
                            <div className="w-1.5 h-6 bg-[#fcd535] rounded-full" />
                            <div>
                                <h2 className="text-xl font-black text-white uppercase tracking-wider">
                                    {item ? 'កែសម្រួល' : 'បន្ថែម'} {section.title}
                                </h2>
                                <p className="text-[11px] text-[#5e6673] font-bold mt-0.5 uppercase tracking-widest">Product Management Matrix</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <button onClick={onClose} className="px-6 py-2.5 text-[#848e9c] hover:text-white font-black text-xs uppercase tracking-widest transition-colors">បោះបង់</button>
                            <button onClick={handleSave} disabled={isLoading} className="px-8 py-2.5 bg-[#fcd535] text-black rounded-sm font-black text-xs uppercase tracking-widest hover:bg-[#f0c832] transition-all active:scale-95 disabled:opacity-60 flex items-center gap-2">
                                {isLoading ? <Spinner size="sm" /> : null} រក្សាទុក
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex justify-between items-center mb-8 relative z-10">
                        <div className="flex items-center gap-4">
                            <div className="w-1.5 h-8 bg-blue-600 rounded-full shadow-[0_0_15px_rgba(37,99,235,0.4)]"></div>
                            <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic">{(item ? 'កែសម្រួល' : 'បន្ថែម')} {section.title}</h2>
                        </div>
                        <button onClick={onClose} className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-gray-500 hover:text-white transition-all active:scale-90 border border-white/5 hover:bg-white/10 shadow-lg">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                )}

                <div className={`flex-grow overflow-y-auto no-scrollbar ${isProductSection ? 'p-6 bg-[#0B0E11]' : 'pr-4 custom-scrollbar'}`}>
                    <div className={isProductSection ? "grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto" : "space-y-6"}>
                        {section.fields.map(field => (
                            <div key={field.name} className={`space-y-2 ${isProductSection && field.type === 'image_url' ? 'md:col-span-2 bg-[#181A20] p-6 rounded-sm border border-[#2b3139]' : ''}`}>
                                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] ml-2">
                                    {t[`field_${field.name}`] || field.label}
                                </label>
                                {renderField(field)}
                            </div>
                        ))}
                    </div>
                </div>
                
                {!isProductSection && renderFooter()}
            </div>
            {cropModal.isOpen && cropModal.src && (
                <ImageCropperModal 
                    isOpen={cropModal.isOpen}
                    src={cropModal.src}
                    onClose={() => setCropModal({ isOpen: false, fieldName: '', src: null, fileName: '' })}
                    onCrop={(blob) => handleCroppedImage(cropModal.fieldName, blob, cropModal.fileName)}
                />
            )}
        </Modal>
    );
};

// ─── Internal Image Cropper Component ──────────────────────────────────
const ImageCropperModal: React.FC<{
    isOpen: boolean;
    src: string;
    onClose: () => void;
    onCrop: (blob: Blob) => void;
}> = ({ isOpen, src: initialSrc, onClose, onCrop }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [currentSrc, setCurrentSrc] = useState(initialSrc);
    const [isRemovingBg, setIsRemovingBg] = useState(false);
    
    // Crop state in percent (%) for responsiveness
    const [crop, setCrop] = useState({ x: 10, y: 10, width: 80, height: 80 }); 
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [resizeCorner, setResizeCorner] = useState<string | null>(null);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    // Initialize crop to 1:1 square in center
    useEffect(() => {
        if (!isOpen) return;
        const img = new Image();
        img.src = currentSrc;
        img.onload = () => {
            const aspect = img.width / img.height;
            if (aspect > 1) {
                const w = (1 / aspect) * 80;
                setCrop({ x: (100 - w) / 2, y: 10, width: w, height: 80 });
            } else {
                const h = aspect * 80;
                setCrop({ x: 10, y: (100 - h) / 2, width: 80, height: h });
            }
        };
    }, [isOpen, currentSrc]);

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging && !isResizing) return;
        if (!imgRef.current) return;

        const img = imgRef.current;
        const dx = ((e.clientX - dragStart.x) / img.clientWidth) * 100;
        const dy = ((e.clientY - dragStart.y) / img.clientHeight) * 100;

        if (isDragging) {
            setCrop(prev => ({
                ...prev,
                x: Math.max(0, Math.min(100 - prev.width, prev.x + dx)),
                y: Math.max(0, Math.min(100 - prev.height, prev.y + dy))
            }));
        } else if (isResizing && resizeCorner) {
            // Use larger delta for 1:1 scaling
            let delta = Math.abs(dx) > Math.abs(dy) ? dx : dy;
            
            setCrop(prev => {
                let newWidth = prev.width;
                let newX = prev.x;
                let newY = prev.y;

                if (resizeCorner === 'se') {
                    newWidth = Math.max(10, Math.min(100 - prev.x, 100 - prev.y, prev.width + delta));
                } else if (resizeCorner === 'nw') {
                    const change = Math.max(-prev.x, -prev.y, Math.min(prev.width - 10, delta));
                    newWidth = prev.width - change;
                    newX = prev.x + change;
                    newY = prev.y + change;
                } else if (resizeCorner === 'ne') {
                    const change = Math.max(-(100 - (prev.x + prev.width)), -prev.y, Math.min(prev.width - 10, -delta));
                    newWidth = prev.width + change;
                    newY = prev.y - change;
                } else if (resizeCorner === 'sw') {
                    const change = Math.max(-prev.x, -(100 - (prev.y + prev.width)), Math.min(prev.width - 10, delta));
                    newWidth = prev.width - change;
                    newX = prev.x + change;
                }

                return { ...prev, x: newX, y: newY, width: newWidth, height: newWidth };
            });
        }
        setDragStart({ x: e.clientX, y: e.clientY });
    };

    const handleCrop = () => {
        if (!canvasRef.current || !imgRef.current) return;
        setIsProcessing(true);
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const img = imgRef.current;
        const x = (crop.x / 100) * img.naturalWidth;
        const y = (crop.y / 100) * img.naturalHeight;
        const w = (crop.width / 100) * img.naturalWidth;
        const h = (crop.height / 100) * img.naturalHeight;
        
        canvas.width = 1024;
        canvas.height = 1024;
        
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, x, y, w, h, 0, 0, 1024, 1024);
        
        canvas.toBlob((blob) => {
            if (blob) onCrop(blob);
            setIsProcessing(false);
        }, 'image/webp', 0.85);
    };

    const handleRemoveBackground = async () => {
        if (isRemovingBg) return;
        setIsRemovingBg(true);
        try {
            const resultBlob = await removeBackground(currentSrc);
            const reader = new FileReader();
            reader.onloadend = () => {
                setCurrentSrc(reader.result as string);
                setIsRemovingBg(false);
            };
            reader.readAsDataURL(resultBlob);
        } catch (error) {
            console.error("Failed to remove background:", error);
            alert("មិនអាចលុបផ្ទៃខាងក្រោយបានទេ សូមព្យាយាមម្តងទៀត។");
            setIsRemovingBg(false);
        }
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-3xl" zIndex="z-[200]">
            <div className="flex flex-col h-full bg-[#0B0E11]">
                <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-[#2b3139] bg-[#181A20]">
                    <div className="flex items-center gap-3">
                        <div className="w-1.5 h-6 bg-[#fcd535] rounded-full" />
                        <h3 className="text-sm font-black text-white uppercase tracking-widest">កែសម្រួលរូបភាព (1:1 Aspect Ratio)</h3>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-500 hover:text-white transition-colors"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                </div>

                <div 
                    className="flex-grow flex items-center justify-center p-8 bg-black/40 relative overflow-hidden"
                    onMouseMove={handleMouseMove}
                    onMouseUp={() => { setIsDragging(false); setIsResizing(false); setResizeCorner(null); }}
                    onMouseLeave={() => { setIsDragging(false); setIsResizing(false); setResizeCorner(null); }}
                >
                    <div className="relative inline-block max-w-full max-h-full shadow-2xl">
                        <img 
                            ref={imgRef}
                            src={currentSrc} 
                            className="max-w-full max-h-[65vh] block select-none pointer-events-none" 
                            alt="To crop"
                        />
                        {/* Crop Overlay */}
                        <div 
                            className="absolute border-2 border-[#fcd535] shadow-[0_0_0_9999px_rgba(0,0,0,0.6)] cursor-move"
                            style={{
                                left: `${crop.x}%`,
                                top: `${crop.y}%`,
                                width: `${crop.width}%`,
                                height: `${crop.height}%`
                            }}
                            onMouseDown={(e) => {
                                if ((e.target as HTMLElement).hasAttribute('data-handle')) return;
                                setIsDragging(true);
                                setDragStart({ x: e.clientX, y: e.clientY });
                            }}
                        >
                            {/* Visual Guides */}
                            <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-20 pointer-events-none">
                                <div className="border-r border-b border-white"></div>
                                <div className="border-r border-b border-white"></div>
                                <div className="border-b border-white"></div>
                                <div className="border-r border-b border-white"></div>
                                <div className="border-r border-b border-white"></div>
                                <div className="border-b border-white"></div>
                                <div className="border-r border-white"></div>
                                <div className="border-r border-white"></div>
                                <div></div>
                            </div>
                            
                            {/* Resize Handles (Corners) */}
                            <div 
                                data-handle="nw"
                                className="absolute -top-2 -left-2 w-4 h-4 bg-[#fcd535] rounded-full cursor-nw-resize z-10 border-2 border-black"
                                onMouseDown={(e) => { e.stopPropagation(); setIsResizing(true); setResizeCorner('nw'); setDragStart({ x: e.clientX, y: e.clientY }); }}
                            ></div>
                            <div 
                                data-handle="ne"
                                className="absolute -top-2 -right-2 w-4 h-4 bg-[#fcd535] rounded-full cursor-ne-resize z-10 border-2 border-black"
                                onMouseDown={(e) => { e.stopPropagation(); setIsResizing(true); setResizeCorner('ne'); setDragStart({ x: e.clientX, y: e.clientY }); }}
                            ></div>
                            <div 
                                data-handle="sw"
                                className="absolute -bottom-2 -left-2 w-4 h-4 bg-[#fcd535] rounded-full cursor-sw-resize z-10 border-2 border-black"
                                onMouseDown={(e) => { e.stopPropagation(); setIsResizing(true); setResizeCorner('sw'); setDragStart({ x: e.clientX, y: e.clientY }); }}
                            ></div>
                            <div 
                                data-handle="se"
                                className="absolute -bottom-2 -right-2 w-4 h-4 bg-[#fcd535] rounded-full cursor-se-resize z-10 border-2 border-black"
                                onMouseDown={(e) => { e.stopPropagation(); setIsResizing(true); setResizeCorner('se'); setDragStart({ x: e.clientX, y: e.clientY }); }}
                            ></div>
                        </div>
                    </div>
                    
                    {/* Event Overlay for dragging/resizing state */}
                    {(isDragging || isResizing) && <div className="fixed inset-0 z-[300] cursor-move"></div>}
                </div>

                <div className="flex-shrink-0 p-6 bg-[#181A20] border-t border-[#2b3139] flex flex-col sm:flex-row gap-4">
                    <div className="flex-grow">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Instruction</p>
                        <p className="text-xs text-gray-400">អូសប្រអប់ពណ៌លឿងដើម្បីរំកិល និងអូសជ្រុងទាំង៤ ដើម្បីពង្រីក/ពង្រួមទំហំ។</p>
                    </div>
                    <div className="flex gap-3">
                        <button 
                            onClick={handleRemoveBackground} 
                            disabled={isRemovingBg || isProcessing}
                            className="px-4 py-2.5 bg-purple-600/20 text-purple-400 border border-purple-600/30 rounded-sm font-black text-[10px] uppercase tracking-widest hover:bg-purple-600 hover:text-white transition-all flex items-center gap-2"
                        >
                            {isRemovingBg ? <Spinner size="sm" /> : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11l-8.485 8.485a2 2 0 01-2.828 0l-4.243-4.243a2 2 0 010-2.828L11.929 3.93a2 2 0 012.828 0l4.243 4.243a2 2 0 010 2.828z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 3L3 13" /></svg>
                            )}
                            លុប Background
                        </button>
                        <button onClick={onClose} className="px-6 py-2.5 text-[#848e9c] hover:text-white font-black text-xs uppercase tracking-widest transition-colors">បោះបង់</button>
                        <button 
                            onClick={handleCrop} 
                            disabled={isProcessing || isRemovingBg}
                            className="px-10 py-2.5 bg-[#fcd535] text-black rounded-sm font-black text-xs uppercase tracking-widest hover:bg-[#f0c832] transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
                        >
                            {isProcessing ? <Spinner size="sm" /> : null}
                            យល់ព្រម (Crop & Upload)
                        </button>
                    </div>
                </div>
                <canvas ref={canvasRef} className="hidden" />
            </div>
        </Modal>
    );
};

export default ConfigEditModal;
