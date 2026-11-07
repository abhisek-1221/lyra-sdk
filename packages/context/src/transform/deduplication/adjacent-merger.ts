import type { DocumentId, TextSpan } from "@lyra-sdk/kernel";
import type { ContextChunk, ContextCitation } from "../../types/index.js";
import type { DeduplicateContext, Deduplicator } from "../strategies.js";

/**
 * Merges chunks in the same document whose spans touch or overlap
 * (`next.start <= currentEnd`). A gap is left alone. The merged
 * text is a fresh slice of the union span, the score is the max,
 * and the timestamp is the earliest defined value. The absorbed
 * chunks' citations are collected into `mergedCitations`. The
 * merged chunk drops its embedding because the vector belonged
 * to a single span.
 */
export class AdjacentMerger implements Deduplicator {
  public readonly name = "adjacent";

  public async deduplicate(
    chunks: readonly ContextChunk[],
    ctx?: DeduplicateContext,
  ): Promise<readonly ContextChunk[]> {
    if (chunks.length === 0) return [];
    const sorted = [...chunks].sort((a, b) => {
      const docCmp = String(a.documentId).localeCompare(String(b.documentId));
      if (docCmp !== 0) return docCmp;
      if (a.span.start !== b.span.start) return a.span.start - b.span.start;
      return a.span.end - b.span.end;
    });
    const runs: ContextChunk[][] = [];
    let run: ContextChunk[] = [sorted[0]!];
    let runEnd = sorted[0]!.span.end;
    for (let i = 1; i < sorted.length; i++) {
      const next = sorted[i]!;
      const sameDoc = run[0]!.documentId === next.documentId;
      if (sameDoc && next.span.start <= runEnd) {
        run.push(next);
        if (next.span.end > runEnd) runEnd = next.span.end;
      } else {
        runs.push(run);
        run = [next];
        runEnd = next.span.end;
      }
    }
    runs.push(run);

    const out: ContextChunk[] = [];
    for (const group of runs) {
      if (group.length === 1) {
        out.push(group[0]!);
        continue;
      }
      out.push(await mergeGroup(group, ctx?.resolveSpan));
    }
    return out;
  }
}

async function mergeGroup(
  group: readonly ContextChunk[],
  resolveSpan: ((documentId: DocumentId, span: TextSpan) => Promise<string>) | undefined,
): Promise<ContextChunk> {
  const head = group[0]!;
  let start = head.span.start;
  let end = head.span.end;
  let score = head.score;
  let timestamp = head.timestamp;
  for (const chunk of group) {
    if (chunk.span.start < start) start = chunk.span.start;
    if (chunk.span.end > end) end = chunk.span.end;
    if (chunk.score > score) score = chunk.score;
    if (chunk.timestamp !== undefined && (timestamp === undefined || chunk.timestamp < timestamp)) {
      timestamp = chunk.timestamp;
    }
  }
  const span: TextSpan = { sourceId: head.span.sourceId, start, end };
  if (resolveSpan === undefined) {
    throw new Error("AdjacentMerger: resolveSpan is required to merge overlapping chunks");
  }
  const text = await resolveSpan(head.documentId, span);
  const mergedCitations: ContextCitation[] = group
    .slice(1)
    .flatMap((chunk) => [chunk.citation, ...(chunk.mergedCitations ?? [])]);
  const speaker = mergedSpeaker(group);
  let merged: ContextChunk = {
    chunkId: head.chunkId,
    documentId: head.documentId,
    text,
    score,
    span,
    citation: head.citation,
    mergedCitations,
  };
  if (timestamp !== undefined) merged = { ...merged, timestamp };
  if (speaker !== undefined) merged = { ...merged, speaker };
  return merged;
}

function mergedSpeaker(group: readonly ContextChunk[]): string | undefined {
  let speaker: string | undefined;
  for (const chunk of group) {
    if (chunk.speaker === undefined) continue;
    if (speaker === undefined) {
      speaker = chunk.speaker;
      continue;
    }
    if (speaker !== chunk.speaker) return undefined;
  }
  return speaker;
}
