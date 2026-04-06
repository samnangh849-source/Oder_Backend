
import React, { useState, useContext, useRef, useEffect } from 'react';
import { AppContext } from '../../../context/AppContext';
import { ConfigSection, getValueCaseInsensitive } from '../../../constants/settingsConfig';
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
                if (section.id === 'roles' && field.name === 'id') {
                    const roles = appData.roles || [];
                    const maxId = roles.reduce((max: number, r: any) => Math.max(max, Number(r.id) || 0), 0);
                    acc[field.name] = maxId + 1;
                } else {
                    acc[field.name] = field.type === 'checkbox' ? false : field.type === 'number' ? 0 : '';
                }
                return acc;
            }, {} as any);
            setFormData(defaultData);
        }
    }, [item, section, appData.roles]);

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
            if (field.dataRef === 'roles') return data.map((r: any) => ({ label: r.RoleName, value: r.RoleName }));
            if (field.dataRef === 'pages') {
                const teams = Array.from(new Set(data.map((p: any) => p.Team))).filter(Boolean);
                return teams.map(t => ({ label: t as string, value: t as string }));
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
                            
                            {field.type === 'checkbox' ? (
                                <div className="flex items-center gap-4 bg-gray-900/50 p-4 rounded-[1.5rem] border border-gray-800 transition-all hover:border-gray-700">
                                    <input type="checkbox" name={field.name} checked={!!formData[field.name]} onChange={handleChange} className="h-6 w-6 rounded-lg border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500" />
                                    <span className="text-sm font-bold text-gray-300">បើកដំណើរការមុខងារនេះ</span>
                                </div>
                            ) : field.type === 'image_url' ? (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <input type="text" name={field.name} value={formData[field.name] || ''} onChange={handleChange} placeholder={field.placeholder || "បិទភ្ជាប់ Link ឬ Upload រូបភាព"} className="form-input flex-grow !py-3.5 !px-5" />
                                        <input type="file" accept="image/*" ref={el => { fileInputRefs.current[field.name] = el; }} onChange={(e) => e.target.files && handleImageUpload(field.name, e.target.files[0])} className="hidden" />
                                        <button type="button" onClick={() => fileInputRefs.current[field.name]?.click()} className="w-12 h-12 bg-blue-600/10 text-blue-400 rounded-2xl border border-blue-500/20 hover:bg-blue-600 hover:text-white transition-all flex flex-shrink-0 items-center justify-center shadow-lg" disabled={uploadingFields[field.name]}>
                                            {uploadingFields[field.name] ? <Spinner size="sm" /> : <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h14a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
                                        </button>
                                    </div>
                                    {formData[field.name] && <div className="relative w-24 h-24 bg-gray-900 rounded-2xl border border-gray-800 p-2 overflow-hidden shadow-inner mx-auto sm:mx-0"><img src={convertGoogleDriveUrl(formData[field.name])} className="w-full h-full object-contain" alt="preview" /></div>}
                                </div>
                            ) : field.type === 'password' ? (
                                <div className="relative">
                                    <input type={passwordVisibility[field.name] ? 'text' : 'password'} name={field.name} value={formData[field.name] || ''} onChange={handleChange} className="form-input !py-3.5 !px-5 pr-14" placeholder={field.placeholder || (item ? 'ទុកទទេបើមិនចង់ប្តូរ' : 'បញ្ចូលពាក្យសម្ងាត់')} />
                                    <button type="button" onClick={() => setPasswordVisibility(prev => ({ ...prev, [field.name]: !prev[field.name] }))} className="absolute inset-y-0 right-0 px-4 text-gray-500 hover:text-white transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={passwordVisibility[field.name] ? "M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7 1.274-4.057 5.064-7 9.542-7 .847 0 1.67 .126 2.454 .364m-3.033 2.446a3 3 0 11-4.243 4.243m4.242-4.242l4.243 4.243M3 3l18 18" : "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"} /></svg></button>
                                </div>
                            ) : field.type === 'select' ? (
                                <div className="relative group">
                                    {field.multiple ? (
                                        <SelectFilter
                                            label=""
                                            value={formData[field.name] || ''}
                                            onChange={(v) => setFormData((prev: any) => ({ ...prev, [field.name]: v }))}
                                            options={getOptions(field)}
                                            placeholder={`-- ${t.select_driver || 'Select'} --`}
                                            multiple={true}
                                        />
                                    ) : (
                                        <>
                                            <select 
                                                name={field.name} 
                                                value={formData[field.name] || ''} 
                                                onChange={handleChange}
                                                className="form-input !py-3.5 !pl-5 !pr-10 bg-gray-900/40 backdrop-blur-xl border border-white/5 rounded-2xl text-[13px] font-bold text-white placeholder:text-gray-600 focus:border-blue-500/50 outline-none transition-all shadow-lg appearance-none w-full cursor-pointer"
                                            >
                                                <option value="">-- {t.select_driver || 'Select'} --</option>
                                                {getOptions(field).map((opt: any) => (
                                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                ))}
                                            </select>
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ) : (
                                <input 
                                    type={field.type} 
                                    name={field.name} 
                                    value={formData[field.name] || ''} 
                                    onChange={handleChange} 
                                    placeholder={field.placeholder}
                                    className={`form-input !py-3.5 !px-5 ${field.readOnly ? 'bg-gray-800/50 text-gray-500 cursor-not-allowed' : ''}`} 
                                    readOnly={field.readOnly || (item && field.name === section.primaryKeyField)} 
                                />
                            )}
                        </div>
                    ))}
                </div>
                {error && <div className="mt-6 p-4 bg-red-500/10 text-red-400 border border-red-500/20 rounded-2xl text-sm font-bold animate-shake">{error}</div>}
                <div className="flex justify-end gap-4 mt-8 pt-6 border-t border-white/5">
                    <button type="button" onClick={onClose} className="px-8 py-3 text-gray-400 hover:text-white font-black uppercase text-xs tracking-widest transition-colors">{t.cancel}</button>
                    <button type="button" onClick={handleSave} className="btn btn-primary px-10 py-3 shadow-lg shadow-blue-600/20 active:scale-95 text-xs font-black uppercase tracking-widest rounded-2xl" disabled={isLoading}>{isLoading ? <Spinner size="sm" /> : t.save}</button>
                </div>
            </div>
        </Modal>
    );
};

export default ConfigEditModal;
