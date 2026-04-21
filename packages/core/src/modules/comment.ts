import type { HttpClient } from "../http.js";
import type {
  Comment,
  CommentOptions,
  CommentStats,
  CommentTextFormat,
  CommentThread,
} from "../types.js";
import { extractVideoId } from "../utils/index.js";

interface YTCommentSnippet {
  authorDisplayName: string;
  authorProfileImageUrl: string;
  authorChannelUrl: string;
  authorChannelId: { value: string };
  textDisplay: string;
  textOriginal?: string;
  likeCount: number;
  publishedAt: string;
  updatedAt: string;
  parentId?: string;
}

interface YTCommentResource {
  id: string;
  snippet: YTCommentSnippet;
}

interface YTCommentThreadSnippet {
  channelId: string;
  videoId: string;
  topLevelComment: YTCommentResource;
  canReply: boolean;
  totalReplyCount: number;
  isPublic: boolean;
}

interface YTCommentThreadResource {
  id: string;
  snippet: YTCommentThreadSnippet;
  replies?: { comments: YTCommentResource[] };
}

interface YTCommentThreadListResponse {
  items: YTCommentThreadResource[];
  nextPageToken?: string;
}

interface YTCommentListResponse {
  items: YTCommentResource[];
  nextPageToken?: string;
}

const PAGE_SIZE = 100;

function mapComment(c: YTCommentResource, textFormat: CommentTextFormat): Comment {
  return {
    id: c.id,
    authorName: c.snippet.authorDisplayName,
    authorProfileImage: c.snippet.authorProfileImageUrl,
    authorChannelUrl: c.snippet.authorChannelUrl,
    authorChannelId: c.snippet.authorChannelId.value,
    text:
      textFormat === "plainText"
        ? (c.snippet.textOriginal ?? c.snippet.textDisplay)
        : c.snippet.textDisplay,
    likeCount: c.snippet.likeCount,
    publishedAt: new Date(c.snippet.publishedAt),
    updatedAt: new Date(c.snippet.updatedAt),
    parentId: c.snippet.parentId,
  };
}

function mapThread(t: YTCommentThreadResource, textFormat: CommentTextFormat): CommentThread {
  return {
    id: t.id,
    videoId: t.snippet.videoId,
    channelId: t.snippet.channelId,
    topLevelComment: mapComment(t.snippet.topLevelComment, textFormat),
    totalReplyCount: t.snippet.totalReplyCount,
    canReply: t.snippet.canReply,
    isPublic: t.snippet.isPublic,
    replies: t.replies?.comments?.map((c) => mapComment(c, textFormat)),
  };
}

function resolveVideoId(urlOrId: string): string {
  return extractVideoId(urlOrId) ?? urlOrId;
}

function buildParams(opts: CommentOptions): Record<string, string> {
  const params: Record<string, string> = {
    part: "snippet,replies",
    maxResults: String(opts.maxResults ?? PAGE_SIZE),
  };
  if (opts.order) params.order = opts.order;
  if (opts.searchTerms) params.searchTerms = opts.searchTerms;
  if (opts.textFormat) params.textFormat = opts.textFormat;
  return params;
}

export async function getVideoComments(
  http: HttpClient,
  videoUrlOrId: string,
  opts: CommentOptions = {}
): Promise<CommentThread[]> {
  const videoId = resolveVideoId(videoUrlOrId);
  const textFormat = opts.textFormat ?? "plainText";
  const maxItems = opts.maxResults ?? Infinity;
  const threads: CommentThread[] = [];
  let pageToken: string | undefined;

  do {
    const params: Record<string, string> = {
      ...buildParams(opts),
      videoId,
    };
    if (pageToken) params.pageToken = pageToken;

    const data = await http.get<YTCommentThreadListResponse>("commentThreads", params);

    if (!data.items?.length) break;

    for (const item of data.items) {
      threads.push(mapThread(item, textFormat));
      if (threads.length >= maxItems) break;
    }

    pageToken = threads.length >= maxItems ? undefined : data.nextPageToken;
  } while (pageToken);

  return threads;
}

export async function getCommentReplies(
  http: HttpClient,
  parentId: string,
  textFormat: CommentTextFormat = "plainText"
): Promise<Comment[]> {
  const comments: Comment[] = [];
  let pageToken: string | undefined;

  do {
    const params: Record<string, string> = {
      part: "snippet",
      parentId,
      maxResults: String(PAGE_SIZE),
      textFormat,
    };
    if (pageToken) params.pageToken = pageToken;

    const data = await http.get<YTCommentListResponse>("comments", params);

    if (!data.items?.length) break;

    for (const item of data.items) {
      comments.push(mapComment(item, textFormat));
    }

    pageToken = data.nextPageToken;
  } while (pageToken);

  return comments;
}

export async function getCommentsWithReplies(
  http: HttpClient,
  videoUrlOrId: string,
  opts: CommentOptions = {}
): Promise<CommentThread[]> {
  const threads = await getVideoComments(http, videoUrlOrId, opts);

  const needsReplies = threads.filter(
    (t) => t.totalReplyCount > 0 && (!t.replies || t.replies.length < t.totalReplyCount)
  );

  if (needsReplies.length === 0) return threads;

  const textFormat = opts.textFormat ?? "plainText";
  await Promise.all(
    needsReplies.map(async (t, i) => {
      const idx = threads.indexOf(t);
      const allReplies = await getCommentReplies(http, t.topLevelComment.id, textFormat);
      threads[idx] = { ...t, replies: allReplies };

      if (i > 0 && i % 5 === 0) {
        await new Promise((r) => setTimeout(r, 100));
      }
    })
  );

  return threads;
}

export async function getTopComments(
  http: HttpClient,
  videoUrlOrId: string,
  limit = 20
): Promise<CommentThread[]> {
  const threads = await getVideoComments(http, videoUrlOrId, {
    order: "relevance",
    maxResults: Math.min(limit, PAGE_SIZE),
  });

  return threads.slice(0, limit);
}

export async function searchComments(
  http: HttpClient,
  videoUrlOrId: string,
  query: string,
  opts: CommentOptions = {}
): Promise<CommentThread[]> {
  return getVideoComments(http, videoUrlOrId, {
    ...opts,
    searchTerms: query,
    textFormat: opts.textFormat ?? "plainText",
  });
}

export async function getChannelComments(
  http: HttpClient,
  channelId: string,
  opts: CommentOptions = {}
): Promise<CommentThread[]> {
  const textFormat = opts.textFormat ?? "plainText";
  const maxItems = opts.maxResults ?? Infinity;
  const threads: CommentThread[] = [];
  let pageToken: string | undefined;

  do {
    const params: Record<string, string> = {
      ...buildParams(opts),
      allThreadsRelatedToChannelId: channelId,
    };
    if (pageToken) params.pageToken = pageToken;

    const data = await http.get<YTCommentThreadListResponse>("commentThreads", params);

    if (!data.items?.length) break;

    for (const item of data.items) {
      threads.push(mapThread(item, textFormat));
      if (threads.length >= maxItems) break;
    }

    pageToken = threads.length >= maxItems ? undefined : data.nextPageToken;
  } while (pageToken);

  return threads;
}

export function getCommentStats(videoId: string, threads: CommentThread[]): CommentStats {
  const allComments: Comment[] = [];
  let totalReplies = 0;

  for (const t of threads) {
    allComments.push(t.topLevelComment);
    if (t.replies) {
      allComments.push(...t.replies);
      totalReplies += t.replies.length;
    }
    totalReplies += Math.max(0, t.totalReplyCount - (t.replies?.length ?? 0));
  }

  const uniqueAuthors = new Set(allComments.map((c) => c.authorChannelId)).size;
  const totalLikes = allComments.reduce((sum, c) => sum + c.likeCount, 0);
  const mostLiked = allComments.reduce<Comment | null>(
    (best, c) => (c.likeCount > (best?.likeCount ?? -1) ? c : best),
    null
  );

  return {
    videoId,
    totalComments: threads.length,
    totalReplies,
    uniqueAuthors,
    mostLikedComment: mostLiked,
    avgLikes:
      allComments.length > 0 ? Math.round((totalLikes / allComments.length) * 100) / 100 : 0,
    replyRatio: threads.length > 0 ? Math.round((totalReplies / threads.length) * 100) / 100 : 0,
  };
}

export function flattenComments(threads: CommentThread[]): Comment[] {
  const flat: Comment[] = [];
  for (const t of threads) {
    flat.push(t.topLevelComment);
    if (t.replies) {
      flat.push(...t.replies);
    }
  }
  return flat;
}
