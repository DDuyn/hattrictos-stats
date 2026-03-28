/**
 * Parses a duration string like "7d", "24h", "3600s", "60m" into seconds.
 * Falls back to 7 days (604800s) for unrecognized formats.
 */
export function parseDurationToSeconds(duration: string): number {
  const match = /^(\d+)([smhd])$/.exec(duration.trim());
  if (!match) return 7 * 24 * 60 * 60; // fallback: 7 days

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 60 * 60;
    case 'd': return value * 24 * 60 * 60;
    default:  return 7 * 24 * 60 * 60;
  }
}
