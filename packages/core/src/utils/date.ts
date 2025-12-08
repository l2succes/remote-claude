/**
 * Format a date as a relative time string (e.g., "2 hours ago", "3 days ago")
 */
export function formatDistanceToNow(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffSecs < 60) {
    return `${diffSecs} second${diffSecs !== 1 ? 's' : ''}`;
  } else if (diffMins < 60) {
    return `${diffMins} minute${diffMins !== 1 ? 's' : ''}`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
  } else if (diffDays < 30) {
    return `${diffDays} day${diffDays !== 1 ? 's' : ''}`;
  } else {
    const diffMonths = Math.floor(diffDays / 30);
    return `${diffMonths} month${diffMonths !== 1 ? 's' : ''}`;
  }
}

/**
 * Format a date as ISO string with local timezone
 */
export function formatDate(date: Date): string {
  return date.toISOString().replace('T', ' ').slice(0, -5);
}

/**
 * Parse a date from various formats
 */
export function parseDate(input: string): Date | null {
  // Try parsing as ISO date
  const isoDate = new Date(input);
  if (!isNaN(isoDate.getTime())) {
    return isoDate;
  }
  
  // Try parsing relative dates
  const now = new Date();
  const match = input.match(/^(\d+)\s*(second|minute|hour|day|week|month)s?\s*ago$/i);
  if (match) {
    const [, amount, unit] = match;
    const value = parseInt(amount || '0');
    
    switch (unit?.toLowerCase()) {
      case 'second':
        return new Date(now.getTime() - value * 1000);
      case 'minute':
        return new Date(now.getTime() - value * 60 * 1000);
      case 'hour':
        return new Date(now.getTime() - value * 60 * 60 * 1000);
      case 'day':
        return new Date(now.getTime() - value * 24 * 60 * 60 * 1000);
      case 'week':
        return new Date(now.getTime() - value * 7 * 24 * 60 * 60 * 1000);
      case 'month':
        return new Date(now.getTime() - value * 30 * 24 * 60 * 60 * 1000);
    }
  }
  
  return null;
}