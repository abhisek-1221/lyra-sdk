import type { HttpClient } from "../http.js";
import type {
  CommentOptions,
  CommentOrder,
  CommentQueryResult,
  CommentTextFormat,
} from "../types.js";
import { extractVideoId } from "../utils/index.js";
import { getCommentStats, getVideoComments, hydrateMissingReplies } from "./comment.js";

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
    const opts: CommentOptions = {};
    if (this.orderValue !== undefined) opts.order = this.orderValue;
    if (this.limitValue !== undefined) opts.maxResults = this.limitValue;
    if (this.searchValue !== undefined) opts.searchTerms = this.searchValue;
    if (this.textFormatValue !== undefined) opts.textFormat = this.textFormatValue;

    let threads = await getVideoComments(this.http, this.videoId, opts);

    if (this.limitValue && threads.length > this.limitValue) {
      threads = threads.slice(0, this.limitValue);
    }

    if (this.fetchAllReplies) {
      const textFormat = this.textFormatValue ?? "plainText";
      threads = await hydrateMissingReplies(this.http, threads, textFormat);
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
