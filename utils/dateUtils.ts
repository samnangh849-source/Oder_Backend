
/**
 * Safely parses a date string into a Date object, handling common formats and iOS specific quirks.
 * Returns null if parsing fails.
 */
export const safeParseDate = (dateStr: string | null | undefined): Date | null => {
    if (!dateStr) return null;

    // 1. Handle "YYYY-MM-DD H:mm" or "YYYY-MM-DD HH:mm" specifically (Common in this app)
    // iOS/Safari fails on "2024-01-01 7:00" (space separator), so we must parse manually or replace space with T.
    const match = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})\s(\d{1,2}):(\d{2})/);
    if (match) {
        const d = new Date(
            parseInt(match[1]),
            parseInt(match[2]) - 1, // Month is 0-indexed
            parseInt(match[3]),
            parseInt(match[4]),
            parseInt(match[5])
        );
        if (!isNaN(d.getTime())) return d;
    }

    // 1.5 Handle "DD/MM/YYYY" or "DD-MM-YYYY" (Common from Google Sheets/Excel)
    const matchDMY = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (matchDMY) {
        const d = new Date(
            parseInt(matchDMY[3]),
            parseInt(matchDMY[2]) - 1,
            parseInt(matchDMY[1])
        );
        // If there's time info as well
        const timeMatch = dateStr.match(/\s(\d{1,2}):(\d{2})(:(\d{2}))?/);
        if (timeMatch) {
            d.setHours(parseInt(timeMatch[1]));
            d.setMinutes(parseInt(timeMatch[2]));
            if (timeMatch[4]) d.setSeconds(parseInt(timeMatch[4]));
        }
        if (!isNaN(d.getTime())) return d;
    }

    // 2. Try Standard Parsing
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d;

    // 3. Fallback: Try replacing space with T for ISO format if mostly compliant
    if (dateStr.includes(' ')) {
        const isoLike = dateStr.replace(' ', 'T');
        const dIso = new Date(isoLike);
        if (!isNaN(dIso.getTime())) return dIso;
    }

    return null;
};

/**
 * Returns a valid Date object or current date if parsing fails.
 */
export const getValidDate = (dateStr: string | null | undefined): Date => {
    return safeParseDate(dateStr) || new Date();
};

/**
 * Returns timestamp number or 0 if invalid
 */
export const getTimestamp = (dateStr: string | null | undefined): number => {
    const d = safeParseDate(dateStr);
    return d ? d.getTime() : 0;
};

/**
 * Formats a date for chat separators (Today, Yesterday, or Date string)
 */
export const formatChatDate = (dateStr: string): string => {
    const date = safeParseDate(dateStr);
    if (!date) return '';

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const checkDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (checkDate.getTime() === today.getTime()) return 'ថ្ងៃនេះ';
    if (checkDate.getTime() === yesterday.getTime()) return 'ម្សិលមិញ';
    
    return date.toLocaleDateString('km-KH', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
};
