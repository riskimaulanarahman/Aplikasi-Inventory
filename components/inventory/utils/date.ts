export function padDatePart(value: number) {
  return value.toString().padStart(2, '0');
}

export function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
}

export function formatMonthKey(date: Date) {
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}`;
}

export function parseIntegerInput(value: string, fallback = 0) {
  if (value.trim() === '') {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}
