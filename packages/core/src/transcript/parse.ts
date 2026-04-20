import { RE_VIDEO_ID, RE_XML_TRANSCRIPT, RE_BCP47_LANG } from "./constants.js";
import { TranscriptInvalidVideoIdError, TranscriptInvalidLangError } from "./errors.js";
import { extractVideoId } from "../utils/url-patterns.js";
import type { TranscriptLine } from "./types.js";

const XML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
};

const RE_XML_ENTITY = /&(?:amp|lt|gt|quot|apos|#39);/g;

export function decodeXmlEntities(text: string): string {
  return text.replace(RE_XML_ENTITY, (m) => XML_ENTITIES[m] ?? m);
}

export function resolveVideoId(input: string): string {
  if (RE_VIDEO_ID.test(input)) return input;
  const extracted = extractVideoId(input);
  if (extracted) return extracted;
  throw new TranscriptInvalidVideoIdError();
}

export function validateLang(lang: string): void {
  if (!RE_BCP47_LANG.test(lang)) {
    throw new TranscriptInvalidLangError(lang);
  }
}

export function parseTranscriptXml(
  xml: string,
  lang: string
): TranscriptLine[] {
  const matches = [...xml.matchAll(RE_XML_TRANSCRIPT)];
  return matches.map((m) => ({
    text: decodeXmlEntities(m[3]),
    duration: parseFloat(m[2]),
    offset: parseFloat(m[1]),
    lang,
  }));
}
