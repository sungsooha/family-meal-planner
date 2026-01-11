export type CalendarCell = { date: string; label: number; inMonth: boolean };

export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function dayTileLabel(isoDate: string, locale = "en-US"): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString(locale, {
    weekday: "short",
    month: "numeric",
    day: "numeric",
  });
}

export function buildCalendar(month: Date): CalendarCell[] {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstDay = new Date(year, monthIndex, 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells: CalendarCell[] = [];
  for (let i = 0; i < startWeekday; i += 1) {
    cells.push({ date: "", label: 0, inMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, monthIndex, day);
    const iso = formatLocalDate(date);
    cells.push({ date: iso, label: day, inMonth: true });
  }
  return cells;
}
