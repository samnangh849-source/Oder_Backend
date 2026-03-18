
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
    // "https://res.cloudinary.com/dhobzwi7h/video/upload/v1773657887/%E1%9E%85%E1%9F%86%E1%9E%8E%E1%9F%81%E1%9F%87%E1%9E%8A%E1%9E%B9%E1%9E%84%E1%9E%A0%E1%9E%B7%E1%9E%9A%E1%9E%89%E1%9F%92%E1%9E%89%E1%9E%9C%E1%9E%8F%E1%9F%92%E1%9E%90%E1%9E%BB_%E1%9E%8A%E1%9F%82%E1%9E%9B%E1%9E%98%E1%9E%93%E1%9E%BB%E1%9E%9F%E1%9F%92%E1%9E%9F%E1%9E%82%E1%9F%92%E1%9E%9A%E1%9E%94%E1%9F%8B%E1%9E%82%E1%9F%92%E1%9E%93%E1%9E%B6%E1%9E%82%E1%9E%BD%E1%9E%9A%E1%9E%8A%E1%9E%B9%E1%9E%84___%E1%9E%82%E1%9E%B8%E1%9E%98_%E1%9E%8A%E1%9E%B6%E1%9E%9A%E1%9F%89%E1%9E%B6_l1SU6y13MV4_y9eexh.mp3", // Monday
    // "https://res.cloudinary.com/dhobzwi7h/video/upload/v1773570977/2_b1bmnx.mp3", // Tuesday
    // "https://res.cloudinary.com/dhobzwi7h/video/upload/v1773567867/Y2K_nqn9nz.mp3", // Wednesday
    // "https://res.cloudinary.com/dhobzwi7h/video/upload/v1773567867/Y2K_nqn9nz.mp3", // Thursday
    // "https://res.cloudinary.com/dhobzwi7h/video/upload/v1773567867/Y2K_nqn9nz.mp3", // Friday
    // "https://res.cloudinary.com/dhobzwi7h/video/upload/v1773571987/1_vnyhy7.mp3", // Saturday
    // "https://res.cloudinary.com/dhobzwi7h/video/upload/v1773570977/2_b1bmnx.mp3"  // Sunday
];

// APP LOGO URL
// សូមប្ដូរ Link រូបភាព Logo របស់អ្នកនៅទីនេះ (Google Drive Link ឬ Direct URL)
// ប្រសិនបើទុកចោល (empty string) កម្មវិធីនឹងប្រើរូបតំណាងលំនាំដើម។
export const APP_LOGO_URL = "https://drive.google.com/file/d/1vb9IG8wn31LDYtUKLurm6cMow0MI4Tee/view?usp=drive_link";

// Chat Sounds
export const SOUND_URLS = {
    NOTIFICATION: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3', // Ding/Chime
    SENT: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3' // Pop/Click
};

export const NOTIFICATION_SOUNDS = [
    { id: 'default', name: 'Default Ding', url: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3' },
    { id: 'professional_1', name: 'Office Chime', url: 'https://assets.mixkit.co/active_storage/sfx/2860/2860-preview.mp3' },
    { id: 'professional_2', name: 'Corporate Bell', url: 'https://assets.mixkit.co/active_storage/sfx/2864/2864-preview.mp3' },
    { id: 'professional_3', name: 'Soft Ping', url: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3' },
    { id: 'professional_4', name: 'Elegant Tone', url: 'https://assets.mixkit.co/active_storage/sfx/2861/2861-preview.mp3' },
    { id: 'bell', name: 'Classic Bell', url: 'https://assets.mixkit.co/active_storage/sfx/2210/2210-preview.mp3' },
    { id: 'digital', name: 'Digital Alert', url: 'https://assets.mixkit.co/active_storage/sfx/1017/1017-preview.mp3' },
    { id: 'futuristic', name: 'Futuristic Blip', url: 'https://assets.mixkit.co/active_storage/sfx/2574/2574-preview.mp3' },
    { id: 'chime', name: 'Crystal Chime', url: 'https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3' },
    { id: 'glass', name: 'Glass Tap', url: 'https://assets.mixkit.co/active_storage/sfx/2870/2870-preview.mp3' },
    { id: 'bubble', name: 'Water Bubble', url: 'https://assets.mixkit.co/active_storage/sfx/1115/1115-preview.mp3' },
    { id: 'pop', name: 'Message Pop', url: 'https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3' },
    { id: 'happy', name: 'Happy Bells', url: 'https://assets.mixkit.co/active_storage/sfx/937/937-preview.mp3' },
    { id: 'success', name: 'Success Sparkle', url: 'https://assets.mixkit.co/active_storage/sfx/1114/1114-preview.mp3' },
    { id: 'click', name: 'Modern Click', url: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3' },
    { id: 'arcade', name: 'Arcade Point', url: 'https://assets.mixkit.co/active_storage/sfx/2044/2044-preview.mp3' },
    { id: 'retro', name: 'Retro Beep', url: 'https://assets.mixkit.co/active_storage/sfx/212/212-preview.mp3' },
    { id: 'alert', name: 'System Alert', url: 'https://assets.mixkit.co/active_storage/sfx/2866/2866-preview.mp3' },
    { id: 'notify', name: 'Simple Notify', url: 'https://assets.mixkit.co/active_storage/sfx/933/933-preview.mp3' },
    { id: 'positive', name: 'Positive Note', url: 'https://assets.mixkit.co/active_storage/sfx/221/221-preview.mp3' }
];
