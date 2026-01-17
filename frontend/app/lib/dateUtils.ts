// Helper to parse date string
function toDate(dateString: string | any): Date {
    if (!dateString) return new Date();

    // Safety check if it's already a Date object
    if (dateString instanceof Date) return dateString;

    // Safety check for string methods
    if (typeof dateString !== 'string') {
        return new Date(dateString);
    }

    // If it already has a timezone indicator (Z or +/-00:00), use it as is
    if (dateString.endsWith('Z') || /[+-]\d{2}(:?\d{2})?$/.test(dateString)) {
        return new Date(dateString);
    }

    // If it's a naive ISO-like string (no Z or offset), force UTC (Database convention)
    if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?/.test(dateString)) {
        return new Date(dateString.replace(' ', 'T') + 'Z');
    }

    return new Date(dateString);
}

export function formatDate(dateString?: string): string {
    if (!dateString) return 'N/A';
    // Forced DD/MM/YYYY using en-GB locale
    return toDate(dateString).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

export function formatDateTime(dateString?: string): string {
    if (!dateString) return 'N/A';
    return toDate(dateString).toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
    });
}

export function getDateLabel(dateString?: string): string {
    if (!dateString) return 'Unknown Date';

    const date = toDate(dateString);
    const now = new Date();

    // Reset time components for accurate day comparison
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    const diffTime = today.getTime() - target.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';

    if (diffDays < 7) {
        return `Last ${date.toLocaleDateString('en-GB', { weekday: 'long' })}`;
    }

    if (diffDays < 14) {
        return 'Last Week';
    }

    if (diffDays < 21) {
        return '2 Weeks Ago';
    }

    if (diffDays < 28) {
        return '3 Weeks Ago';
    }

    if (diffDays < 60) {
        return 'Last Month';
    }

    // Older: Month Year
    return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

export function getRelativeTime(dateString?: string): string {
    if (!dateString) return 'N/A';

    const date = toDate(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);

    // Future protection
    if (diffMs < -60000) { // More than 1 minute in the future
        return 'In the future';
    }
    if (diffMs < 0) return 'Just now';

    // < 1 minute
    if (diffMin < 1) return 'Just now';

    // < 60 minutes
    if (diffMin < 60) {
        return `${diffMin} min${diffMin === 1 ? '' : 's'} ago`;
    }

    // < 24 hours
    if (diffHour < 24) {
        return `${diffHour} hr${diffHour === 1 ? '' : 's'} ago`;
    }

    // Check if it's today (by calendar day) - fallback
    const isSameDay = date.getDate() === now.getDate() &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear();

    if (isSameDay) {
        return 'Earlier today';
    }

    // Calculate days difference (start of day to start of day)
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffDays = Math.floor((todayStart.getTime() - dateStart.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return 'Yesterday';

    if (diffDays < 7) {
        return `Last ${date.toLocaleDateString('en-GB', { weekday: 'long' })}`;
    }

    if (diffDays < 14) {
        return 'Last Week';
    }

    if (diffDays < 30) {
        return `${Math.floor(diffDays / 7)} weeks ago`;
    }

    if (diffDays < 60) {
        return 'Last Month';
    }

    // Older: Nov 2025
    return date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}
