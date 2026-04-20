import type { HttpClient } from "../http.js";
import type { I18nLanguage, I18nRegion } from "../types.js";

interface YTI18nRegionResource {
  id: string;
  snippet: { gl: string; name: string };
}

interface YTI18nRegionListResponse {
  items: YTI18nRegionResource[];
}

interface YTI18nLanguageResource {
  id: string;
  snippet: { hl: string; name: string };
}

interface YTI18nLanguageListResponse {
  items: YTI18nLanguageResource[];
}

export async function getRegions(http: HttpClient, hl?: string): Promise<I18nRegion[]> {
  const params: Record<string, string> = { part: "snippet" };
  if (hl) params.hl = hl;

  const data = await http.get<YTI18nRegionListResponse>("i18nRegions", params);

  return (data.items ?? []).map((item) => ({
    id: item.id,
    gl: item.snippet.gl,
    name: item.snippet.name,
  }));
}

export async function getLanguages(http: HttpClient, hl?: string): Promise<I18nLanguage[]> {
  const params: Record<string, string> = { part: "snippet" };
  if (hl) params.hl = hl;

  const data = await http.get<YTI18nLanguageListResponse>("i18nLanguages", params);

  return (data.items ?? []).map((item) => ({
    id: item.id,
    hl: item.snippet.hl,
    name: item.snippet.name,
  }));
}
