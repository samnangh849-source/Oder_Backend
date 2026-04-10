
// This should be replaced with your actual Render.com Web Service URL.
// Ensure there is no trailing slash.
// សូមបិទភ្ជាប់ (Paste) Web Service URL ពី Render.com មកទីនេះ (ដោយមិនមានសញ្ញា / នៅខាងចុង)
export const WEB_APP_URL = "https://oder-backend-2.onrender.com";

// NEW: URL for the external label printer service. 
// The Order ID will be appended to this URL.
// Example: "https://my-printer.com/print?id="
// If this URL is empty, the print button will not be shown.
// សូមបញ្ចូល URL សម្រាប់ Label Printer នៅទីនេះ (Order ID នឹងត្រូវបានបន្ថែមដោយស្វ័យប្រវត្តិ)
export const LABEL_PRINTER_URL_BASE = "https://samnangh849-source.github.io/LabelPro/";

// APP LOGO URL
// សូមប្ដូរ Link រូបភាព Logo របស់អ្នកនៅទីនេះ (Google Drive Link ឬ Direct URL)
// ប្រសិនបើទុកចោល (empty string) កម្មវិធីនឹងប្រើរូបតំណាងលំនាំដើម។
export const APP_LOGO_URL = "https://drive.google.com/file/d/1vb9IG8wn31LDYtUKLurm6cMow0MI4Tee/view?usp=drive_link";

// ============================================================
// SOUND LIBRARY - Notification & Status sounds only
// ============================================================

export const SOUND_URLS = {
    NOTIFICATION: 'https://res.cloudinary.com/dhobzwi7h/video/upload/v1774094352/Apple_Pay_Success_Sound_Effect_ul3ka5.mp3',
};

// Full NOTIFICATION_SOUNDS palette for the settings panel
// Each sound is carefully chosen to be very short (click/pop style).
export const NOTIFICATION_SOUNDS = [
    // Soft, short interaction tones
    { id: 'default', name: 'Modern Click', url: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3' },
    { id: 'professional_1', name: 'APPLE', url: 'https://res.cloudinary.com/dhobzwi7h/video/upload/v1774094352/Apple_Pay_Success_Sound_Effect_ul3ka5.mp3' },
    { id: 'professional_2', name: 'Interface Tick', url: 'https://assets.mixkit.co/active_storage/sfx/2567/2567-preview.mp3' },
    { id: 'click', name: 'Soft Tap', url: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3' },
    { id: 'pop', name: 'Elegant Bubble', url: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3' },
    { id: 'bubble', name: 'Digital Drop', url: 'https://assets.mixkit.co/active_storage/sfx/1120/1120-preview.mp3' },

    // Status sounds (short versions)
    { id: 'success', name: 'Crisp Success', url: 'https://res.cloudinary.com/dhobzwi7h/video/upload/v1774094352/Apple_Pay_Success_Sound_Effect_ul3ka5.mp3' },
    { id: 'error', name: 'Minimal Alert', url: 'https://res.cloudinary.com/dhobzwi7h/video/upload/v1774095073/Error_beavk0.mp3' },
    { id: 'notify', name: 'Modern Ping', url: 'https://res.cloudinary.com/dhobzwi7h/video/upload/v1774094352/Apple_Pay_Success_Sound_Effect_ul3ka5.mp3' },
];

