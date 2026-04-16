// ---------------------------------------------------------------------------
// lyra-sdk — Number / date formatting
// ---------------------------------------------------------------------------

/**
 * Compact number: `1_500_000` → `"1.5M"`.
 *
 * Falls back to the raw number string when `Intl` is unavailable.
 */
export function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact" }).format(n);
}

/**
 * Long-form date: `"2024-01-15T…"` → `"January 15, 2024"`.
 */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Relative time label: returns `"3 days ago"`, `"2 hours ago"`, etc.
 */
export function relativeTime(date: Date): string {
  const now = Date.now();
  const diffMs = Math.abs(now - date.getTime());
  const diffMinutes = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffDays >= 1) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  if (diffHours >= 1) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  return `${diffMinutes} minute${diffMinutes !== 1 ? "s" : ""} ago`;
}
