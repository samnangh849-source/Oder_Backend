
import React from 'react';
import Modal from '../../common/Modal';
import Spinner from '../../common/Spinner';

interface SystemUpdateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (message: string) => void;
    isProcessing: boolean;
}

const SystemUpdateModal: React.FC<SystemUpdateModalProps> = ({ isOpen, onClose, onConfirm, isProcessing }) => {
    const [message, setMessage] = React.useState('We are updating the system to improve performance and add new features.');

    if (!isOpen) return null;
    return (
        <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-md">
            <div className="p-6 text-center">
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20 animate-pulse">
                    <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                </div>
                <h3 className="text-xl font-black text-white mb-2 uppercase tracking-tight">System Update</h3>
                <p className="text-gray-400 text-sm mb-4 leading-relaxed">
                    សកម្មភាពនេះនឹងតម្រូវឱ្យអ្នកប្រើប្រាស់ទាំងអស់ (All Users) ចាកចេញពីប្រព័ន្ធ (Log Out) ដើម្បីធ្វើបច្ចុប្បន្នភាព។
                </p>

                <div className="mb-6 text-left">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Notification Message</label>
                    <textarea 
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-sm text-white focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all resize-none h-24"
                        placeholder="Enter notification message for users..."
                    />
                </div>

                <div className="flex gap-3 justify-center">
                    <button onClick={onClose} className="px-6 py-3 rounded-xl bg-gray-800 text-gray-400 font-bold hover:bg-gray-700 transition-all border border-gray-700">បោះបង់</button>
                    <button 
                        onClick={() => onConfirm(message)} 
                        disabled={isProcessing}
                        className="px-6 py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-500 transition-all flex items-center gap-2 shadow-lg shadow-red-900/20 active:scale-95 disabled:opacity-50"
                    >
                        {isProcessing ? <Spinner size="sm" /> : 'Confirm Update'}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default SystemUpdateModal;
