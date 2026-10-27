export function normalizeArchiveText(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0640]/g, "")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[-'’]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function recordMatchesQuery(arabicName: string, englishName: string | null, query: string) {
  const normalizedQuery = normalizeArchiveText(query);
  if (!normalizedQuery) return true;

  const searchKey = normalizeArchiveText(`${arabicName} ${englishName ?? ""}`);
  return normalizedQuery.split(" ").every((term) => searchKey.includes(term));
}

export function matchesMonth(date: string | null, month: string | undefined) {
  if (!month) return true;
  if (!date) return false;
  const value = date.trim();
  // ISO dates (YYYY-MM-DD), timestamps, and common D/M/YYYY or D-M-YYYY forms.
  if (value.startsWith(month)) return true;
  const match = value.match(/^(\d{1,2})[\/. -](\d{1,2})[\/. -](\d{4})/);
  if (match) {
    const [, first, second, year] = match;
    const monthNumber = Number(second);
    const yearNumber = Number(year);
    return `${yearNumber}-${String(monthNumber).padStart(2, "0")}` === month;
  }
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, "0")}` === month;
  }
  return false;
}
