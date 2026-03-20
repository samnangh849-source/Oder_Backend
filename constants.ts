
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

// ============================================================
// CURATED SOUND LIBRARY
// All sounds carefully selected to be pleasant, non-jarring.
// Sources: Mixkit (royalty free), verified working URLs.
// ============================================================

// Chat-specific sounds (short, clean)
export const SOUND_URLS = {
    // A short, clear tick/pop for notifications
    NOTIFICATION: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3', // Modern Click
    // A subtle pop for sent messages
    SENT: 'https://assets.mixkit.co/active_storage/sfx/1110/1110-preview.mp3', // UI Pop
};

// Full NOTIFICATION_SOUNDS palette for the settings panel
// Each sound is carefully chosen to be very short (click/pop style).
export const NOTIFICATION_SOUNDS = [
    // Soft, short interaction tones
    { id: 'default',       name: 'Short Click',      url: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3' }, // Modern click
    { id: 'professional_1',name: 'Light Pop',        url: 'https://assets.mixkit.co/active_storage/sfx/1110/1110-preview.mp3' }, // Pop
    { id: 'professional_2',name: 'Subtle Tick',      url: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3' }, // UI Blip
    { id: 'click',         name: 'Basic Click',      url: 'https://assets.mixkit.co/active_storage/sfx/2359/2359-preview.mp3' }, // Soft click
    { id: 'pop',           name: 'Bubble Pop',       url: 'https://assets.mixkit.co/active_storage/sfx/2835/2835-preview.mp3' }, // Soft bubble
    { id: 'bubble',        name: 'Tiny Drop',        url: 'https://assets.mixkit.co/active_storage/sfx/1120/1120-preview.mp3' }, // Subtle tick
    
    // Status sounds (short versions)
    { id: 'success',       name: 'Short Ding',       url: 'https://assets.mixkit.co/active_storage/sfx/1114/1114-preview.mp3' }, // Office chime (short)
    { id: 'error',         name: 'Short Alert',      url: 'https://assets.mixkit.co/active_storage/sfx/1119/1119-preview.mp3' }, // Error alert
    { id: 'notify',        name: 'Quick Notify',     url: 'https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3' }, // Soft ping
];

