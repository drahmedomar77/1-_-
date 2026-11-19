import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "thnapp.progress.v1";

export type GameProgress = {
  points: number;
  stars: number;
  hearts: number;
  completedIds: string[];
  speechCompletedIds: string[];
  dailyCompletedDays: string[];
  lastPlayDate: string | null;
  streak: number;
  bestTimedScore: number;
  settings: {
    sound: boolean;
    haptics: boolean;
    speechChallenges: boolean;
  };
};

export const defaultProgress: GameProgress = {
  points: 0,
  stars: 0,
  hearts: 5,
  completedIds: [],
  speechCompletedIds: [],
  dailyCompletedDays: [],
  lastPlayDate: null,
  streak: 0,
  bestTimedScore: 0,
  settings: { sound: true, haptics: true, speechChallenges: true },
};

export async function loadProgress(): Promise<GameProgress> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultProgress;
    const parsed = JSON.parse(raw) as Partial<GameProgress>;
    return {
      ...defaultProgress,
      ...parsed,
      stars:
        typeof parsed.stars === "number" && Number.isFinite(parsed.stars)
          ? Math.max(0, Math.trunc(parsed.stars))
          : 0,
      completedIds: Array.isArray(parsed.completedIds)
        ? parsed.completedIds
        : [],
      speechCompletedIds: Array.isArray(parsed.speechCompletedIds)
        ? parsed.speechCompletedIds
        : [],
      dailyCompletedDays: Array.isArray(parsed.dailyCompletedDays)
        ? parsed.dailyCompletedDays
        : [],
      settings: { ...defaultProgress.settings, ...(parsed.settings ?? {}) },
    };
  } catch {
    return defaultProgress;
  }
}

export async function saveProgress(progress: GameProgress): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // تبقى الجلسة قابلة للعب حتى لو منع النظام التخزين مؤقتاً.
  }
}

export function todayKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const digitMap: Record<string, string> = {
  "٠": "0",
  "١": "1",
  "٢": "2",
  "٣": "3",
  "٤": "4",
  "٥": "5",
  "٦": "6",
  "٧": "7",
  "٨": "8",
  "٩": "9",
  "۰": "0",
  "۱": "1",
  "۲": "2",
  "۳": "3",
  "۴": "4",
  "۵": "5",
  "۶": "6",
  "۷": "7",
  "۸": "8",
  "۹": "9",
};

export function normalizeArabic(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/[٠-٩۰-۹]/g, (digit) => digitMap[digit] ?? digit)
    .replace(/[؟?!.,،؛:«»"'()\[\]{}\-ـ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function answerMatches(guess: string, answer: string): boolean {
  return normalizeArabic(guess) === normalizeArabic(answer);
}

export function dayBefore(key: string): string {
  const date = new Date(`${key}T12:00:00`);
  date.setDate(date.getDate() - 1);
  return todayKey(date);
}
