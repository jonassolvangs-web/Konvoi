// ─── Availability time calculation helpers ──────────────────────

export interface TimeRange {
  start: number; // minutes from midnight
  end: number;
}

export interface TimeSlot {
  time: string; // "HH:mm"
  minutes: number;
}

/** Convert "HH:mm" to minutes from midnight */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** Convert minutes from midnight to "HH:mm" */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Get ISO day of week: 1=Monday, 7=Sunday */
export function getISODayOfWeek(date: Date): number {
  const day = date.getDay(); // 0=Sun, 1=Mon, ...
  return day === 0 ? 7 : day;
}

/**
 * Subtract booked ranges from available ranges.
 * All ranges are in minutes from midnight.
 * Returns remaining free windows.
 */
export function subtractRanges(
  available: TimeRange[],
  booked: TimeRange[]
): TimeRange[] {
  let result = [...available];

  for (const b of booked) {
    const next: TimeRange[] = [];
    for (const a of result) {
      // No overlap
      if (b.end <= a.start || b.start >= a.end) {
        next.push(a);
        continue;
      }
      // Left remainder
      if (b.start > a.start) {
        next.push({ start: a.start, end: b.start });
      }
      // Right remainder
      if (b.end < a.end) {
        next.push({ start: b.end, end: a.end });
      }
    }
    result = next;
  }

  return result;
}

/**
 * Split free windows into discrete time slots of given duration.
 */
export function splitIntoSlots(
  windows: TimeRange[],
  slotMinutes: number
): TimeSlot[] {
  const slots: TimeSlot[] = [];

  for (const w of windows) {
    let cursor = w.start;
    while (cursor + slotMinutes <= w.end) {
      slots.push({
        time: minutesToTime(cursor),
        minutes: cursor,
      });
      cursor += slotMinutes;
    }
  }

  return slots;
}

/** Format a date to YYYY-MM-DD string */
export function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
