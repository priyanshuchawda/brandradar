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
