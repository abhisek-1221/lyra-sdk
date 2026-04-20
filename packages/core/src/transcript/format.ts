import type { TranscriptLine } from "./types.js";

function formatSrtTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

function formatVttTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}

export function toSRT(lines: TranscriptLine[]): string {
  return lines
    .map((line, i) => {
      const start = formatSrtTimestamp(line.offset);
      const end = formatSrtTimestamp(line.offset + line.duration);
      return `${i + 1}\n${start} --> ${end}\n${line.text}`;
    })
    .join("\n\n");
}

export function toVTT(lines: TranscriptLine[]): string {
  const cues = lines
    .map((line) => {
      const start = formatVttTimestamp(line.offset);
      const end = formatVttTimestamp(line.offset + line.duration);
      return `${start} --> ${end}\n${line.text}`;
    })
    .join("\n\n");
  return `WEBVTT\n\n${cues}`;
}

export function toPlainText(lines: TranscriptLine[], separator = "\n"): string {
  return lines.map((l) => l.text).join(separator);
}
