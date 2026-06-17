
import { APP_LOGO_URL } from '../constants';
import { convertGoogleDriveUrl } from './fileUtils';

/**
 * Requests permission for system notifications if supported.
 * Returns true if granted.
 */
export const requestNotificationPermission = async (): Promise<boolean> => {
    // ឆែកមើលថាតើ Browser គាំទ្រ Notification ដែរឬទេ
    if (!('Notification' in window)) {
        console.warn("Browser នេះមិនគាំទ្រប្រព័ន្ធ Notification ទេ។");
        return false;
    }

    if (Notification.permission === 'granted') {
        return true;
    }

    // បើសិនជាមិនទាន់បានអនុញ្ញាត (Granted) ទេ យើងនឹងស្នើសុំ
    if (Notification.permission !== 'denied') {
        try {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                console.log("ទទួលបានការអនុញ្ញាត (Permission Granted) ជោគជ័យ!");
                return true;
            }
        } catch (e) {
            console.error("Permission request failed", e);
            return false;
        }
    }

    return false;
};

/**
 * Sends a system native notification using Service Worker (if available) or standard Notification API.
 * Optimized for Chrome/Android compatibility by using registration.showNotification().
 */
export const sendSystemNotification = async (title: string, body: string) => {
    if (!('Notification' in window)) return;

    if (Notification.permission === 'default') {
        await requestNotificationPermission();
    }

    if (Notification.permission !== 'granted') {
        console.warn("Notification permission not granted. Cannot send notification.");
        return;
    }

    // Use a static, safe icon URL because Google Drive redirects can be blocked by Chrome notifications
    // Fallback to a reliable CDN icon if APP_LOGO_URL conversion fails or is slow
    const safeIcon = "https://cdn-icons-png.flaticon.com/512/1827/1827404.png"; 

    const uniqueTag = 'osystem-alert-' + Date.now();

    // Use 'any' to avoid TS error about 'vibrate' not existing in NotificationOptions in some environments
    const options: any = {
        body: body,
        icon: safeIcon, 
        badge: safeIcon,
        vibrate: [200, 100, 200],
        tag: uniqueTag,
        renotify: true,
        requireInteraction: true,
        data: {
            url: window.location.href
        },
        silent: false
    };

    let sent = false;

    // 1. Preferred Method: Service Worker Registration (Required for Android/Mobile Chrome)
    if ('serviceWorker' in navigator) {
        try {
            // Use getRegistration() to avoid hanging indefinitely if no SW is active (unlike .ready)
            const registration = await navigator.serviceWorker.getRegistration();
            
            if (registration && registration.active) {
                await registration.showNotification(title, options);
                console.log("Notification sent via Service Worker");
                sent = true;
            } else {
                console.warn("Service Worker not active or not found. Falling back...");
            }
        } catch (e) {
            console.warn("Service Worker notification failed, falling back to legacy API...", e);
        }
    }

    // 2. Fallback Method: Classic Web API (Works for Safari/Desktop Firefox if SW fails)
    if (!sent) {
        try {
            const notification = new Notification(title, options);
            notification.onclick = function() {
                window.focus();
                notification.close();
            };
            console.log("Notification sent via Legacy Web API");
        } catch (e) {
            console.error("All notification methods failed:", e);
        }
    }
};