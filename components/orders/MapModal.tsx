
import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import Spinner from '../common/Spinner';

interface MapModalProps {
    isOpen: boolean;
    onClose: () => void;
    url: string;
}

const MapModal: React.FC<MapModalProps> = ({ isOpen, onClose, url }) => {
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (isOpen) {
            setIsLoading(true);
        }
    }, [isOpen, url]);

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-4xl">
            <h2 className="text-xl font-bold mb-2 text-white">ស្វែងរកទីតាំង</h2>
            <p className="text-sm text-gray-400 mb-4">
                បន្ទាប់ពីរកឃើញទីតាំងត្រឹមត្រូវ សូមចម្លង (Copy) អាសយដ្ឋាន ឬ Link រួចបិទផ្ទាំងនេះ ហើយបិទភ្ជាប់ (Paste) ចូលទៅក្នុងប្រអប់ "ទីតាំងលម្អិត" វិញ។
            </p>
            <div className="relative w-full h-[70vh] bg-gray-900 rounded-lg overflow-hidden border border-gray-700">
                {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Spinner size="lg"/>
                        <span className="ml-3 text-gray-300">កំពុងដំណើរការផែនទី...</span>
                    </div>
                )}
                <iframe
                    src={url}
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    allowFullScreen={false}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    onLoad={() => setIsLoading(false)}
                    className={isLoading ? 'opacity-0' : 'opacity-100 transition-opacity duration-500'}
                ></iframe>
            </div>
        </Modal>
    );
};

export default MapModal;
