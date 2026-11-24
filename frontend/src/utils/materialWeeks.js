const weekPrefix = /^week\s+(\d+)\s*[-–—:]\s*(?=\S)/i;

export function getMaterialWeek(title) {
  const match = weekPrefix.exec(title?.trim() ?? "");
  const week = Number(match?.[1]);
  return Number.isSafeInteger(week) && week > 0 ? week : null;
}

export function titleWithWeek(title, selectedWeek) {
  const original = title.trim();
  const week = getMaterialWeek(original);
  if (selectedWeek === null || Number(selectedWeek) === week) return original;
  const content = week === null ? original : original.replace(weekPrefix, "");
  return selectedWeek && content ? `Week ${String(Number(selectedWeek)).padStart(2, "0")} — ${content}` : content;
}

export function weekTitleError(savedTitle, selectedWeek) {
  if (selectedWeek && (!Number.isSafeInteger(Number(selectedWeek)) || Number(selectedWeek) < 1)) {
    return "Enter a positive whole number for the teaching week.";
  }
  if (savedTitle.length > 200) return "Shorten the title so it fits within 200 characters including the week.";
  return "";
}
