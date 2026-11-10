function buildIsoDate(day: number, month: number, year: number) {
  if (year < 1000 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseDayMonthYearToIso(value: string) {
  if (!value.trim()) return null;
  const match = value.trim().match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  return buildIsoDate(Number(day), Number(month), Number(year));
}

export function formatDateDayMonthYear(value: string | null | undefined) {
  const text = value?.trim();
  if (!text) return null;

  const yearFirst = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?=$|[T\s])/);
  if (yearFirst) {
    const [, year, month, day] = yearFirst;
    const iso = buildIsoDate(Number(day), Number(month), Number(year));
    return iso ? `${iso.slice(8, 10)}-${iso.slice(5, 7)}-${iso.slice(0, 4)}` : text;
  }

  const dayFirst = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dayFirst) {
    const [, day, month, year] = dayFirst;
    const iso = buildIsoDate(Number(day), Number(month), Number(year));
    return iso ? `${iso.slice(8, 10)}-${iso.slice(5, 7)}-${iso.slice(0, 4)}` : text;
  }

  return text;
}
