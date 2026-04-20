import type { HttpClient } from "../http.js";
import type { CommentOptions, CommentOrder, CommentQueryResult, CommentTextFormat } from "../types.js";
import { extractVideoId } from "../utils/index.js";
import {
  getCommentReplies,
  getCommentStats,
  getVideoComments,
} from "./comment.js";

export class CommentQueryBuilder {
  private readonly http: HttpClient;
  private readonly videoId: string;
  private orderValue?: CommentOrder;
  private searchValue?: string;
  private limitValue?: number;
  private fetchAllReplies = false;
  private textFormatValue?: CommentTextFormat;

  constructor(http: HttpClient, videoUrlOrId: string) {
    this.http = http;
    this.videoId = extractVideoId(videoUrlOrId) ?? videoUrlOrId;
  }

  order(order: CommentOrder): this {
    this.orderValue = order;
    return this;
  }

  search(query: string): this {
    this.searchValue = query;
    return this;
  }

  limit(n: number): this {
    this.limitValue = n;
    return this;
  }

  withAllReplies(): this {
    this.fetchAllReplies = true;
    return this;
  }

  textFormat(format: CommentTextFormat): this {
    this.textFormatValue = format;
    return this;
  }

  async execute(): Promise<CommentQueryResult> {
    const opts: CommentOptions = {
      order: this.orderValue,
      maxResults: this.limitValue,
      searchTerms: this.searchValue,
      textFormat: this.textFormatValue,
    };

    let threads = await getVideoComments(this.http, this.videoId, opts);

    if (this.limitValue && threads.length > this.limitValue) {
      threads = threads.slice(0, this.limitValue);
    }

    if (this.fetchAllReplies) {
      const needsReplies = threads.filter(
        (t) => t.totalReplyCount > 0 && (!t.replies || t.replies.length < t.totalReplyCount),
      );

      const textFormat = this.textFormatValue ?? "plainText";
      await Promise.all(
        needsReplies.map(async (t) => {
          const idx = threads.indexOf(t);
          const allReplies = await getCommentReplies(this.http, t.topLevelComment.id, textFormat);
          threads[idx] = { ...t, replies: allReplies };
        }),
      );
    }

    const stats = getCommentStats(this.videoId, threads);

    return {
      videoId: this.videoId,
      threads,
      totalResults: threads.length,
      stats,
    };
  }
}
