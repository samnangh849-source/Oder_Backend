
import React, { useContext } from 'react';
import { AppContext } from '../../context/AppContext';

const ImpersonationBanner: React.FC = () => {
    const { currentUser, returnToAdmin } = useContext(AppContext);

    if (!currentUser) return null;

    return (
        <div className="fixed top-0 left-0 right-0 bg-yellow-500 text-gray-900 text-center p-2 font-semibold z-50 text-sm sm:text-base">
            <span>កំពុងមើលក្នុងនាម <strong>{currentUser.FullName}</strong>.</span>
            <button onClick={returnToAdmin} className="ml-4 px-3 py-1 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 transition-colors">
                ត្រឡប់ទៅគណនី Admin
            </button>
        </div>
    );
};

export default ImpersonationBanner;
