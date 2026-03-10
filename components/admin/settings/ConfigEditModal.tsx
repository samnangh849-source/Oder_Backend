
import React, { useState, useContext, useRef, useEffect } from 'react';
import { AppContext } from '../../../context/AppContext';
import { ConfigSection, getValueCaseInsensitive } from '../../../constants/settingsConfig';
import Spinner from '../../common/Spinner';
import Modal from '../../common/Modal';
import { WEB_APP_URL } from '../../../constants';
import { fileToBase64, convertGoogleDriveUrl } from '../../../utils/fileUtils';

interface ConfigEditModalProps {
    section: ConfigSection;
    item: any | null;
    onClose: () => void;
    onSave: (item: any) => void;
}

const ConfigEditModal: React.FC<ConfigEditModalProps> = ({ section, item, onClose, onSave }) => {
    const { refreshData, appData } = useContext(AppContext);
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
                acc[field.name] = field.type === 'checkbox' ? false : field.type === 'number' ? 0 : '';
                return acc;
            }, {} as any);
            setFormData(defaultData);
        }
    }, [item, section]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setFormData((prev: any) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleImageUpload = async (fieldName: string, file: File) => {
        if (!file) return;
        setUploadingFields(prev => ({ ...prev, [fieldName]: true }));
        try {
            const base64Data = await fileToBase64(file);
            const response = await fetch(`${WEB_APP_URL}/api/upload-image`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fileData: base64Data, fileName: file.name, mimeType: file.type })
            });
            const result = await response.json();
            if (!response.ok || result.status !== 'success') throw new Error(result.message || 'Upload failed');
            setFormData((prev: any) => ({ ...prev, [fieldName]: result.url }));
        } catch (err: any) { setError(err.message); } finally { setUploadingFields(prev => ({ ...prev, [fieldName]: false })); }
    };
    
    const handleSave = async () => {
        setError('');
        for (const field of section.fields) {
            if (field.type !== 'checkbox' && (formData[field.name] === undefined || formData[field.name] === '') && field.name !== 'Password' && !item) {
                 setError(`សូមបំពេញចន្លោះ "${field.label}"`);
                 return;
            }
        }
        setIsLoading(true);
        try {
            const endpoint = item ? '/api/admin/update-sheet' : '/api/admin/add-row';
            const payloadData = { ...formData };
            section.fields.forEach(field => { if (field.type === 'number') payloadData[field.name] = Number(payloadData[field.name]); });
            if (item && section.id === 'users' && !payloadData.Password) delete payloadData.Password;
            const payload: any = { sheetName: section.sheetName, newData: payloadData };
            if (item) payload.primaryKey = { [section.primaryKeyField]: getValueCaseInsensitive(item, section.primaryKeyField) };
            const response = await fetch(`${WEB_APP_URL}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) throw new Error('Save failed');
            await refreshData();
            onSave(formData);
        } catch (err: any) { setError(err.message); } finally { setIsLoading(false); }
    };
    
    return (
        <Modal isOpen={true} onClose={onClose} maxWidth="max-w-xl">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-black text-white">{(item ? 'កែសម្រួល' : 'បន្ថែម')} {section.title}</h2>
                <button onClick={onClose} className="p-2 text-gray-500 hover:text-white transition-colors">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
            <div className="space-y-5 max-h-[65vh] overflow-y-auto pr-2 custom-scrollbar">
                {section.fields.map(field => (
                    <div key={field.name} className="space-y-1.5">
                        <label className="block text-xs font-black text-gray-500 uppercase tracking-widest">{field.label}</label>
                        {field.type === 'checkbox' ? (
                            <div className="flex items-center gap-3 bg-gray-900/50 p-3 rounded-xl border border-gray-700">
                                <input type="checkbox" name={field.name} checked={!!formData[field.name]} onChange={handleChange} className="h-6 w-6 rounded-lg border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500" />
                                <span className="text-sm text-gray-300">បើកដំណើរការមុខងារនេះ</span>
                            </div>
                        ) : field.type === 'image_url' ? (
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <input type="text" name={field.name} value={formData[field.name] || ''} onChange={handleChange} placeholder="បិទភ្ជាប់ Link ឬ Upload រូបភាព" className="form-input flex-grow !py-2.5" />
                                    <input type="file" accept="image/*" ref={el => { fileInputRefs.current[field.name] = el; }} onChange={(e) => e.target.files && handleImageUpload(field.name, e.target.files[0])} className="hidden" />
                                    <button type="button" onClick={() => fileInputRefs.current[field.name]?.click()} className="p-2.5 bg-blue-600/10 text-blue-400 rounded-xl border border-blue-500/20 hover:bg-blue-600 hover:text-white transition-all" disabled={uploadingFields[field.name]}>
                                        {uploadingFields[field.name] ? <Spinner size="sm" /> : <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h14a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
                                    </button>
                                </div>
                                {formData[field.name] && <div className="relative w-32 h-32 bg-gray-900 rounded-2xl border border-gray-700 p-2 overflow-hidden shadow-inner mx-auto sm:mx-0"><img src={convertGoogleDriveUrl(formData[field.name])} className="w-full h-full object-contain" alt="preview" /></div>}
                            </div>
                        ) : field.type === 'password' ? (
                            <div className="relative">
                                <input type={passwordVisibility[field.name] ? 'text' : 'password'} name={field.name} value={formData[field.name] || ''} onChange={handleChange} className="form-input !py-2.5 pr-12" placeholder={item ? 'ទុកទទេបើមិនចង់ប្តូរ' : 'បញ្ចូលពាក្យសម្ងាត់'} />
                                <button type="button" onClick={() => setPasswordVisibility(prev => ({ ...prev, [field.name]: !prev[field.name] }))} className="absolute inset-y-0 right-0 px-4 text-gray-500 hover:text-white transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={passwordVisibility[field.name] ? "M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7 1.274-4.057 5.064-7 9.542-7 .847 0 1.67 .126 2.454 .364m-3.033 2.446a3 3 0 11-4.243 4.243m4.242-4.242l4.243 4.243M3 3l18 18" : "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"} /></svg></button>
                            </div>
                        ) : (section.id === 'users' && field.name === 'Role') ? (
                            <select 
                                name={field.name} 
                                value={formData[field.name] || ''} 
                                onChange={(e: any) => handleChange(e)}
                                className="form-input !py-2.5 bg-gray-900 text-white"
                            >
                                <option value="">-- ជ្រើសរើសតួនាទី (Select Role) --</option>
                                {(appData.roles || []).map(r => (
                                    <option key={r.id || r.RoleName} value={r.RoleName}>{r.RoleName}</option>
                                ))}
                                {/* Fallback roles in case roles table is empty */}
                                {(!appData.roles || appData.roles.length === 0) && (
                                    <>
                                        <option value="Admin">Admin</option>
                                        <option value="Sales">Sales</option>
                                        <option value="Fulfillment">Fulfillment</option>
                                        <option value="Stock">Stock</option>
                                        <option value="Driver">Driver</option>
                                    </>
                                )}
                            </select>
                        ) : (
                            <input type={field.type} name={field.name} value={formData[field.name] || ''} onChange={handleChange} className="form-input !py-2.5" readOnly={item && field.name === section.primaryKeyField} />
                        )}
                    </div>
                ))}
            </div>
            {error && <div className="mt-4 p-3 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl text-sm font-bold">{error}</div>}
            <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-700/50">
                <button type="button" onClick={onClose} className="px-6 py-2.5 text-gray-400 hover:text-white font-bold transition-colors">បោះបង់</button>
                <button type="button" onClick={handleSave} className="btn btn-primary px-8 shadow-lg shadow-blue-600/20 active:scale-95" disabled={isLoading}>{isLoading ? <Spinner size="sm" /> : 'រក្សាទុក'}</button>
            </div>
        </Modal>
    );
};

export default ConfigEditModal;
