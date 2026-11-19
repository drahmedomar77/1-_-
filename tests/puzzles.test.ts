import { describe, expect, test, vi } from "vitest";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: { getItem: vi.fn(), setItem: vi.fn() },
}));

import { DIFFICULTIES, PUZZLES } from "../data/puzzles";
import { answerMatches } from "../lib/game-state";

const corePuzzles = PUZZLES.filter((puzzle) => puzzle.kind !== "نطق");

describe("بنك ألغاز ذِهْن", () => {
  test("المعرفات فريدة وكل سؤال مكتمل المحتوى", () => {
    expect(new Set(PUZZLES.map((puzzle) => puzzle.id)).size).toBe(
      PUZZLES.length,
    );
    for (const puzzle of PUZZLES) {
      expect(puzzle.prompt.trim().length).toBeGreaterThan(0);
      expect(puzzle.answer.trim().length).toBeGreaterThan(0);
      expect(puzzle.hint.trim().length).toBeGreaterThan(0);
      expect(puzzle.explanation.trim().length).toBeGreaterThan(0);
    }
  });

  test("الاختيارات الصحيحة موجودة مرة واحدة فقط ضمن الخيارات", () => {
    for (const puzzle of PUZZLES.filter((item) => item.choices)) {
      expect(puzzle.choices).toContain(puzzle.answer);
      expect(
        puzzle.choices?.filter((choice) => choice === puzzle.answer),
      ).toHaveLength(1);
    }
  });

  test("المسار الأساسي يتدرج من السهل إلى المتوسط ثم الصعب دون إدراج النطق", () => {
    expect(corePuzzles).toHaveLength(16);
    expect(corePuzzles.every((puzzle) => puzzle.kind !== "نطق")).toBe(true);
    expect(
      DIFFICULTIES.map(
        (difficulty) =>
          corePuzzles.filter((puzzle) => puzzle.difficulty === difficulty)
            .length,
      ),
    ).toEqual([6, 5, 5]);
  });

  test("هناك تمرينا نطق اختياريان خارج المراحل الأساسية", () => {
    expect(PUZZLES.filter((puzzle) => puzzle.kind === "نطق")).toHaveLength(2);
    expect(corePuzzles.some((puzzle) => puzzle.kind === "نطق")).toBe(false);
  });

  test("تقبل مطابقة الإجابة الأرقام العربية والتشكيل وعلامات الترقيم", () => {
    expect(answerMatches("٤", "4")).toBe(true);
    expect(
      answerMatches(
        "سافر سامر صباحاً صوب الساحل.",
        "سافر سامر صباحا صوب الساحل",
      ),
    ).toBe(true);
  });
});
