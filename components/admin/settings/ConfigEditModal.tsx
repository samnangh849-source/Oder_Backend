
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
        setUploadingFields(prev => ({ ...prev, [fieldName]: true }));
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
                    sheetName: section.sheetName,
                    primaryKey: item ? { [section.primaryKeyField]: item[section.primaryKeyField] } : undefined,
                    targetColumn: fieldName
                })
            });
            const result = await response.json();
            if (!response.ok || result.status !== 'success') throw new Error(result.message || 'Upload failed');
            
            const finalUrl = result.url;
            setFormData((prev: any) => ({ ...prev, [fieldName]: finalUrl }));
        } catch (err: any) { setError(err.message); } finally { setUploadingFields(prev => ({ ...prev, [fieldName]: false })); }
    };
    
    const handleSave = async () => {
        setError('');
        for (const field of section.fields) {
            // Skip validation for readOnly fields or optional fields like Password when editing
            if (field.readOnly) continue;
            
            if (field.type !== 'checkbox' && (formData[field.name] === undefined || formData[field.name] === '')) {
                 if (field.name === 'Password' && item) {
                     // OK to leave empty when editing
                     continue;
                 }
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
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <input type="text" name={field.name} value={formData[field.name] || ''} onChange={handleChange} placeholder={field.placeholder || "Link ឬ Upload រូបភាព"} className="form-input flex-grow !py-3 !px-4 text-sm" />
                    <input type="file" accept="image/*" ref={el => { fileInputRefs.current[field.name] = el; }} onChange={(e) => e.target.files && handleImageUpload(field.name, e.target.files[0])} className="hidden" />
                    <button type="button" onClick={() => fileInputRefs.current[field.name]?.click()} className="w-10 h-10 bg-[#2b3139] text-[#848e9c] rounded-xl border border-[#3d4451] hover:border-[#fcd535]/40 hover:text-[#fcd535] transition-all flex-shrink-0 flex items-center justify-center" disabled={uploadingFields[field.name]}>
                        {uploadingFields[field.name] ? <Spinner size="sm" /> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h14a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
                    </button>
                </div>
                {formData[field.name] && <img src={convertGoogleDriveUrl(formData[field.name])} className="w-16 h-16 rounded-xl object-cover bg-[#1e2329] border border-[#2b3139]" alt="preview" />}
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
            <Modal isOpen={true} onClose={onClose} maxWidth="max-w-lg">
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
                                <SelectFilter label="" value={formData['Role'] || ''} onChange={(v) => setFormData((prev: any) => ({ ...prev, Role: v }))} options={getOptions(roleField)} placeholder="-- ជ្រើសរើស --" multiple={true} />
                            </div>
                            <div>
                                {renderLabel('ក្រុម (Team)')}
                                <SelectFilter label="" value={formData['Team'] || ''} onChange={(v) => setFormData((prev: any) => ({ ...prev, Team: v }))} options={getOptions(teamField)} placeholder="-- ជ្រើសរើស --" multiple={true} />
                            </div>
                        </div>

                        {/* Telegram */}
                        {telegramField && (
                            <div>
                                {renderLabel('Telegram Username')}
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5e6673] font-bold text-sm select-none">@</span>
                                    <input type="text" name="TelegramUsername" value={formData['TelegramUsername'] || ''} onChange={handleChange} placeholder="john_doe" className="form-input !py-3 !pl-8 !pr-4 text-sm w-full font-mono" />
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
    return (
        <Modal isOpen={true} onClose={onClose} maxWidth="max-w-2xl">
            <div className="p-8 flex flex-col h-full">
                <div className="flex justify-between items-center mb-8 relative z-10">
                    <div className="flex items-center gap-4">
                        <div className="w-1.5 h-8 bg-blue-600 rounded-full shadow-[0_0_15px_rgba(37,99,235,0.4)]"></div>
                        <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic">{(item ? 'កែសម្រួល' : 'បន្ថែម')} {section.title}</h2>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-gray-500 hover:text-white transition-all active:scale-90 border border-white/5 hover:bg-white/10 shadow-lg">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-4 custom-scrollbar flex-grow">
                    {section.fields.map(field => (
                        <div key={field.name} className="space-y-2">
                            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] ml-2">{t[`field_${field.name}`] || field.label}</label>
                            {renderField(field)}
                        </div>
                    ))}
                </div>
                {renderFooter()}
            </div>
        </Modal>
    );
};

export default ConfigEditModal;
