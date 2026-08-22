/** Discord hard limit is 2000; leave room for formatting. */
export function chunkDiscordContent(content: string, max = 1900): string[] {
  if (content.length <= max) return [content];
  const chunks: string[] = [];
  let rest = content;
  while (rest.length > 0) {
    if (rest.length <= max) {
      chunks.push(rest);
      break;
    }
    let cut = rest.lastIndexOf("\n", max);
    if (cut < max * 0.5) cut = max;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut).replace(/^\n+/, "");
  }
  return chunks;
}

export function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

/**
 * Format an ISO or date string into a Discord timestamp string: <t:UNIX:STYLE>
 * Styles: 'd' (short date), 'D' (long date), 't' (short time), 'T' (long time),
 * 'f' (short date/time), 'F' (long date/time), 'R' (relative time)
 */
export function discordTimestamp(
  dateStr?: string | null,
  style: "d" | "D" | "t" | "T" | "f" | "F" | "R" = "D",
): string | null {
  if (!dateStr) return null;
  const parsed = new Date(dateStr);
  if (isNaN(parsed.getTime())) return null;
  const unix = Math.floor(parsed.getTime() / 1000);
  return `<t:${unix}:${style}>`;
}

export function discordRelativeTimestamp(dateStr?: string | null): string | null {
  return discordTimestamp(dateStr, "R");
}
