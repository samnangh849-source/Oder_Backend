
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

// Background Music URLs (7 songs for 7 days)
// Monday to Sunday order
export const WEEKLY_MUSIC_URLS = [
    "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", // Monday
    "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3", // Tuesday
    "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3", // Wednesday
    "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3", // Thursday
    "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3", // Friday
    "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3", // Saturday
    "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3"  // Sunday
];

// APP LOGO URL
// សូមប្ដូរ Link រូបភាព Logo របស់អ្នកនៅទីនេះ (Google Drive Link ឬ Direct URL)
// ប្រសិនបើទុកចោល (empty string) កម្មវិធីនឹងប្រើរូបតំណាងលំនាំដើម។
export const APP_LOGO_URL = "https://drive.google.com/file/d/1vb9IG8wn31LDYtUKLurm6cMow0MI4Tee/view?usp=drive_link";

// Chat Sounds (Using more reliable open-source sounds)
export const SOUND_URLS = {
    NOTIFICATION: 'https://notificationsounds.com/storage/sounds/notifications/glass-clinking.mp3', 
    SENT: 'https://notificationsounds.com/storage/sounds/notifications/ping.mp3' 
};

export const NOTIFICATION_SOUNDS = [
    { id: 'default', name: 'Default Ding', url: 'https://notificationsounds.com/storage/sounds/notifications/glass-clinking.mp3' },
    { id: 'professional_1', name: 'Office Chime', url: 'https://notificationsounds.com/storage/sounds/notifications/soft-bells.mp3' },
    { id: 'professional_2', name: 'Corporate Bell', url: 'https://notificationsounds.com/storage/sounds/notifications/clear-announcement.mp3' },
    { id: 'click', name: 'Modern Click', url: 'https://notificationsounds.com/storage/sounds/notifications/ping.mp3' }
];
