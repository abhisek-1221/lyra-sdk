/**
 * Format a transcript timestamp (in seconds) as `HH:MM:SS` or
 * `MM:SS` for clips under an hour.
 *
 * Examples:
 *   - `formatTimestamp(0)` -> `"00:00"`
 *   - `formatTimestamp(75)` -> `"01:15"`
 *   - `formatTimestamp(3725)` -> `"01:02:05"`
 *
 * The function clamps negative values to `0` and rounds
 * sub-second values to the nearest integer.
 */
export function formatTimestamp(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const pad = (n: number): string => n.toString().padStart(2, "0");
  if (hours > 0) return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
  return `${pad(minutes)}:${pad(secs)}`;
}
