// Indian numbering + currency formatting helpers.

export function groupIndian(value: number): string {
  const neg = value < 0;
  let n = Math.abs(Math.round(value)).toString();
  if (n.length <= 3) return (neg ? "-" : "") + n;
  const last3 = n.slice(-3);
  let rest = n.slice(0, -3);
  rest = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return (neg ? "-" : "") + rest + "," + last3;
}

export function formatINR(value: number | null | undefined): string {
  const v = typeof value === "number" && isFinite(value) ? value : 0;
  return "\u20B9" + groupIndian(v);
}

export function formatCompact(value: number | null | undefined): string {
  const v = typeof value === "number" && isFinite(value) ? value : 0;
  const abs = Math.abs(v);
  if (abs >= 10000000) return "\u20B9" + (v / 10000000).toFixed(2) + "Cr";
  if (abs >= 100000) return "\u20B9" + (v / 100000).toFixed(2) + "L";
  if (abs >= 1000) return "\u20B9" + (v / 1000).toFixed(1) + "K";
  return formatINR(v);
}

export function formatDate(iso?: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso).slice(0, 10);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateShort(iso?: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso).slice(0, 10);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

// Parse a date-only string ("YYYY-MM-DD" or ISO) as a LOCAL date, avoiding the
// UTC-midnight shift that makes dates appear one day off in some timezones.
export function parseDateLocal(value?: string | null): Date | null {
  if (!value) return null;
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Day / month / year parts for date badges (timezone-safe).
export function eventDateParts(value?: string | null): { day: string; month: string; year: string } {
  const d = parseDateLocal(value);
  if (!d) return { day: "\u2014", month: "", year: "" };
  return { day: String(d.getDate()), month: MONTHS_SHORT[d.getMonth()], year: String(d.getFullYear()) };
}

// Full readable event date, e.g. "15 Jun 2026" (timezone-safe).
export function formatEventDate(value?: string | null): string {
  const d = parseDateLocal(value);
  if (!d) return "-";
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

export function timeAgo(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return formatDate(iso);
}
