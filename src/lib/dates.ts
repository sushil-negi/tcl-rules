// Returns a valid Date or null. Never throws.
export function safeDate(value: string | Date | undefined | null): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Formats a datetime for UI; returns "—" on invalid input.
export function fmtDateTime(value: string | Date | undefined | null): string {
  const d = safeDate(value);
  return d ? d.toLocaleString() : "—";
}

// Formats a date (no time) for UI; returns "—" on invalid input.
export function fmtDate(value: string | Date | undefined | null): string {
  const d = safeDate(value);
  return d ? d.toLocaleDateString() : "—";
}
