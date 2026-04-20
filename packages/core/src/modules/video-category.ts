import { NotFoundError } from "../errors.js";
import type { HttpClient } from "../http.js";
import type { VideoCategory } from "../types.js";

interface YTVideoCategoryResource {
  id: string;
  snippet: {
    channelId: string;
    title: string;
    assignable: boolean;
  };
}

interface YTVideoCategoryListResponse {
  items: YTVideoCategoryResource[];
}

function mapCategory(item: YTVideoCategoryResource): VideoCategory {
  return {
    id: item.id,
    title: item.snippet.title,
    assignable: item.snippet.assignable,
    channelId: item.snippet.channelId,
  };
}

export async function getVideoCategory(http: HttpClient, id: string): Promise<VideoCategory> {
  const data = await http.get<YTVideoCategoryListResponse>("videoCategories", {
    part: "snippet",
    id,
  });

  const item = data.items?.[0];
  if (!item) throw new NotFoundError("VideoCategory", id);

  return mapCategory(item);
}

export async function getVideoCategories(
  http: HttpClient,
  ids: string[],
): Promise<VideoCategory[]> {
  if (ids.length === 0) return [];

  const data = await http.get<YTVideoCategoryListResponse>("videoCategories", {
    part: "snippet",
    id: ids.join(","),
  });

  return (data.items ?? []).map(mapCategory);
}

export async function getVideoCategoriesByRegion(
  http: HttpClient,
  regionCode: string,
  hl?: string,
): Promise<VideoCategory[]> {
  const params: Record<string, string> = {
    part: "snippet",
    regionCode,
  };
  if (hl) params.hl = hl;

  const data = await http.get<YTVideoCategoryListResponse>("videoCategories", params);

  return (data.items ?? []).map(mapCategory);
}
