export interface Colleague {
  id: string;
  name: string;
  role: string;
}

export interface TimeSlot {
  time: string;
  available: boolean;
}

export interface SlotsResponse {
  colleague: string;
  date: string;
  slots: TimeSlot[];
}

export const COLLEAGUES: Colleague[] = [
  { id: "alex_morgan", name: "Alex Morgan", role: "Senior Developer" },
  { id: "maria_chen", name: "Maria Chen", role: "Product Manager" },
  { id: "david_kim", name: "David Kim", role: "UX Designer" },
  { id: "elena_ross", name: "Elena Ross", role: "QA Engineer" },
  { id: "ivan_petersen", name: "Ivan Petersen", role: "DevOps Engineer" },
];

/**
 * Simple deterministic hash from a string — returns a non-negative integer.
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Generates the list of 30-minute time slots from 09:00 to 17:30.
 * Availability is deterministic based on colleague + date + slot index.
 * Approximately 40% of slots are unavailable.
 */
export function generateSlots(colleagueId: string, date: string): TimeSlot[] {
  const slots: TimeSlot[] = [];

  // 09:00 → 17:30, step 30 min → 18 slots
  const startHour = 9;
  const startMinute = 0;
  const totalSlots = 18;

  for (let i = 0; i < totalSlots; i++) {
    const totalMinutes = startHour * 60 + startMinute + i * 30;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const time = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;

    // Deterministic availability: hash of colleague + date + slot index
    const seed = simpleHash(`${colleagueId}:${date}:${i}`);
    // ~40% unavailable: if seed % 10 < 4 → unavailable
    const available = seed % 10 >= 4;

    slots.push({ time, available });
  }

  return slots;
}

/**
 * Returns tomorrow's date in YYYY-MM-DD format.
 */
export function getTomorrowDate(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().slice(0, 10);
}

/**
 * Validates that a string matches YYYY-MM-DD format.
 */
export function isValidDate(dateStr: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr) && !isNaN(Date.parse(dateStr));
}

/**
 * Checks whether a colleague ID exists in the mock data.
 */
export function findColleague(id: string): Colleague | undefined {
  return COLLEAGUES.find((c) => c.id === id);
}
