import { themeLabels, type BoardTheme } from "@/lib/presentation/board-themes";
import type { ActivityKind } from "@/lib/learn/curriculum";

export function learningText(text: string, theme: BoardTheme) {
  const labels = themeLabels(theme);
  const terms: Record<string, string> = {
    ...labels.sides,
    ...labels.pieces,
  };
  return text.replace(
    /\{(orcas|sharks|orca|shark)\}/g,
    (_, word: string) => terms[word],
  );
}

export const activitySection = {
  lesson: "lessons",
  puzzle: "puzzles",
  quiz: "lessons",
} as const;

export function activityHref(kind: ActivityKind, id: string) {
  return `/learn?section=${activitySection[kind]}&activity=${id}#academy-activity`;
}
