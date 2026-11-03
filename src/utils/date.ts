/** Format a database date (YYYY-MM-DD) as DD-MM-YYYY without timezone shifts. */
export function formatDate(date: string | null | undefined): string {
  if (!date) return "—";

  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(date.trim());
  if (!match) return date;

  const [, year, month, day] = match;
  return `${day.padStart(2, "0")}-${month.padStart(2, "0")}-${year}`;
}
