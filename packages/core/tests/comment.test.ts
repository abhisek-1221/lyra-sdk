import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpClient } from "../src/http.js";
import {
  flattenComments,
  getChannelComments,
  getCommentReplies,
  getCommentStats,
  getCommentsWithReplies,
  getTopComments,
  getVideoComments,
  searchComments,
} from "../src/modules/comment.js";
import { CommentQueryBuilder } from "../src/modules/comment-query.js";
import type { CommentThread } from "../src/types.js";

function createMockHttp(responses: Record<string, unknown>): HttpClient {
  const http = new HttpClient({ apiKey: "test-key" });

  vi.spyOn(http, "get").mockImplementation(
    async (path: string, params?: Record<string, string>) => {
      const key = buildMockKey(path, params);
      const res = responses[key] ?? responses[path];
      if (!res) throw new Error(`Unmocked request: ${key}`);
      return res;
    }
  );

  return http;
}

function buildMockKey(path: string, params?: Record<string, string>): string {
  if (!params) return path;
  const sorted = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  return `${path}?${sorted}`;
}

const THREAD_1 = {
  id: "thread1",
  snippet: {
    channelId: "UCxxx",
    videoId: "dQw4w9WgXcQ",
    topLevelComment: {
      id: "comment1",
      snippet: {
        authorDisplayName: "Alice",
        authorProfileImageUrl: "https://img.com/alice.jpg",
        authorChannelUrl: "https://youtube.com/channel/UCalice",
        authorChannelId: { value: "UCalice" },
        textDisplay: "Great video!",
        likeCount: 42,
        publishedAt: "2024-01-15T10:00:00Z",
        updatedAt: "2024-01-15T10:00:00Z",
      },
    },
    canReply: true,
    totalReplyCount: 1,
    isPublic: true,
  },
  replies: {
    comments: [
      {
        id: "reply1",
        snippet: {
          authorDisplayName: "Bob",
          authorProfileImageUrl: "https://img.com/bob.jpg",
          authorChannelUrl: "https://youtube.com/channel/UCbob",
          authorChannelId: { value: "UCbob" },
          textDisplay: "Thanks!",
          likeCount: 5,
          publishedAt: "2024-01-15T12:00:00Z",
          updatedAt: "2024-01-15T12:00:00Z",
          parentId: "comment1",
        },
      },
    ],
  },
};

const THREAD_2 = {
  id: "thread2",
  snippet: {
    channelId: "UCxxx",
    videoId: "dQw4w9WgXcQ",
    topLevelComment: {
      id: "comment2",
      snippet: {
        authorDisplayName: "Charlie",
        authorProfileImageUrl: "https://img.com/charlie.jpg",
        authorChannelUrl: "https://youtube.com/channel/UCcharlie",
        authorChannelId: { value: "UCcharlie" },
        textDisplay: "Love this song",
        likeCount: 100,
        publishedAt: "2024-01-16T10:00:00Z",
        updatedAt: "2024-01-16T10:00:00Z",
      },
    },
    canReply: true,
    totalReplyCount: 0,
    isPublic: true,
  },
};

const SINGLE_PAGE = {
  items: [THREAD_1, THREAD_2],
};

const REPLY_PAGE = {
  items: [
    {
      id: "reply1",
      snippet: {
        authorDisplayName: "Bob",
        authorProfileImageUrl: "https://img.com/bob.jpg",
        authorChannelUrl: "https://youtube.com/channel/UCbob",
        authorChannelId: { value: "UCbob" },
        textDisplay: "Thanks!",
        likeCount: 5,
        publishedAt: "2024-01-15T12:00:00Z",
        updatedAt: "2024-01-15T12:00:00Z",
        parentId: "comment1",
      },
    },
  ],
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("getVideoComments", () => {
  it("fetches comment threads for a video", async () => {
    const http = createMockHttp({ commentThreads: SINGLE_PAGE });
    const threads = await getVideoComments(http, "dQw4w9WgXcQ");

    expect(threads).toHaveLength(2);
    expect(threads[0].topLevelComment.authorName).toBe("Alice");
    expect(threads[0].topLevelComment.likeCount).toBe(42);
    expect(threads[1].topLevelComment.authorName).toBe("Charlie");
  });

  it("resolves video URL to ID", async () => {
    const http = createMockHttp({ commentThreads: SINGLE_PAGE });
    const threads = await getVideoComments(http, "https://youtu.be/dQw4w9WgXcQ");

    expect(threads).toHaveLength(2);
    expect(http.get).toHaveBeenCalledWith(
      "commentThreads",
      expect.objectContaining({ videoId: "dQw4w9WgXcQ" })
    );
  });

  it("auto-paginates through pages", async () => {
    const http = new HttpClient({ apiKey: "test-key" });
    let callCount = 0;

    vi.spyOn(http, "get").mockImplementation(async (path: string) => {
      if (path === "commentThreads") {
        callCount++;
        if (callCount === 1) {
          return { items: [THREAD_1], nextPageToken: "PAGE2" };
        }
        return { items: [THREAD_2] };
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    const threads = await getVideoComments(http, "dQw4w9WgXcQ");

    expect(threads).toHaveLength(2);
    expect(http.get).toHaveBeenCalledTimes(2);
  });

  it("maps reply comments from thread", async () => {
    const http = createMockHttp({ commentThreads: SINGLE_PAGE });
    const threads = await getVideoComments(http, "dQw4w9WgXcQ");

    expect(threads[0].replies).toHaveLength(1);
    expect(threads[0].replies![0].authorName).toBe("Bob");
    expect(threads[0].replies![0].parentId).toBe("comment1");
  });

  it("returns empty array for video with no comments", async () => {
    const http = createMockHttp({ commentThreads: { items: [] } });
    const threads = await getVideoComments(http, "dQw4w9WgXcQ");

    expect(threads).toEqual([]);
  });

  it("passes order and searchTerms options", async () => {
    const http = createMockHttp({ commentThreads: SINGLE_PAGE });
    await getVideoComments(http, "dQw4w9WgXcQ", { order: "relevance", searchTerms: "love" });

    expect(http.get).toHaveBeenCalledWith(
      "commentThreads",
      expect.objectContaining({
        order: "relevance",
        searchTerms: "love",
      })
    );
  });
});

describe("getCommentReplies", () => {
  it("fetches all replies for a comment", async () => {
    const http = createMockHttp({ comments: REPLY_PAGE });
    const replies = await getCommentReplies(http, "comment1");

    expect(replies).toHaveLength(1);
    expect(replies[0].authorName).toBe("Bob");
    expect(replies[0].parentId).toBe("comment1");
  });

  it("passes textFormat param", async () => {
    const http = createMockHttp({ comments: REPLY_PAGE });
    await getCommentReplies(http, "comment1", "html");

    expect(http.get).toHaveBeenCalledWith(
      "comments",
      expect.objectContaining({
        parentId: "comment1",
        textFormat: "html",
      })
    );
  });
});

describe("getCommentsWithReplies", () => {
  it("auto-fetches missing replies", async () => {
    const threadWithMissing = {
      ...THREAD_1,
      replies: undefined,
      snippet: { ...THREAD_1.snippet, totalReplyCount: 2 },
    };
    const http = new HttpClient({ apiKey: "test-key" });

    vi.spyOn(http, "get").mockImplementation(async (path: string) => {
      if (path === "commentThreads") {
        return { items: [threadWithMissing, THREAD_2] };
      }
      if (path === "comments") {
        return {
          items: [
            REPLY_PAGE.items[0],
            {
              id: "reply2",
              snippet: {
                authorDisplayName: "Dave",
                authorProfileImageUrl: "https://img.com/dave.jpg",
                authorChannelUrl: "https://youtube.com/channel/UCdave",
                authorChannelId: { value: "UCdave" },
                textDisplay: "Agreed!",
                likeCount: 3,
                publishedAt: "2024-01-15T14:00:00Z",
                updatedAt: "2024-01-15T14:00:00Z",
                parentId: "comment1",
              },
            },
          ],
        };
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    const threads = await getCommentsWithReplies(http, "dQw4w9WgXcQ");

    expect(threads[0].replies).toHaveLength(2);
    expect(threads[0].replies![1].authorName).toBe("Dave");
  });

  it("skips reply fetch when all replies present", async () => {
    const http = new HttpClient({ apiKey: "test-key" });
    let commentCallCount = 0;

    vi.spyOn(http, "get").mockImplementation(async (path: string) => {
      if (path === "commentThreads") return SINGLE_PAGE;
      if (path === "comments") {
        commentCallCount++;
        return REPLY_PAGE;
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    const threads = await getCommentsWithReplies(http, "dQw4w9WgXcQ");

    expect(threads[0].replies).toHaveLength(1);
    expect(commentCallCount).toBe(0);
  });
});

describe("getTopComments", () => {
  it("fetches comments with relevance order and limits results", async () => {
    const http = createMockHttp({ commentThreads: SINGLE_PAGE });
    const threads = await getTopComments(http, "dQw4w9WgXcQ", 1);

    expect(threads).toHaveLength(1);
    expect(http.get).toHaveBeenCalledWith(
      "commentThreads",
      expect.objectContaining({
        order: "relevance",
      })
    );
  });
});

describe("searchComments", () => {
  it("passes searchTerms to getVideoComments", async () => {
    const http = createMockHttp({ commentThreads: SINGLE_PAGE });
    const threads = await searchComments(http, "dQw4w9WgXcQ", "love");

    expect(threads).toHaveLength(2);
    expect(http.get).toHaveBeenCalledWith(
      "commentThreads",
      expect.objectContaining({
        searchTerms: "love",
      })
    );
  });
});

describe("getChannelComments", () => {
  it("fetches comments for a channel", async () => {
    const http = createMockHttp({ commentThreads: SINGLE_PAGE });
    const threads = await getChannelComments(http, "UCxxx");

    expect(threads).toHaveLength(2);
    expect(http.get).toHaveBeenCalledWith(
      "commentThreads",
      expect.objectContaining({
        allThreadsRelatedToChannelId: "UCxxx",
      })
    );
  });
});

describe("getCommentStats", () => {
  it("computes aggregate stats from threads", () => {
    const threads: CommentThread[] = [
      {
        id: "t1",
        videoId: "vid1",
        channelId: "ch1",
        topLevelComment: {
          id: "c1",
          authorName: "Alice",
          authorProfileImage: "",
          authorChannelUrl: "",
          authorChannelId: "UCalice",
          text: "Great",
          likeCount: 10,
          publishedAt: new Date(),
          updatedAt: new Date(),
        },
        totalReplyCount: 1,
        canReply: true,
        isPublic: true,
        replies: [
          {
            id: "r1",
            authorName: "Bob",
            authorProfileImage: "",
            authorChannelUrl: "",
            authorChannelId: "UCbob",
            text: "Thanks",
            likeCount: 5,
            publishedAt: new Date(),
            updatedAt: new Date(),
            parentId: "c1",
          },
        ],
      },
      {
        id: "t2",
        videoId: "vid1",
        channelId: "ch1",
        topLevelComment: {
          id: "c2",
          authorName: "Charlie",
          authorProfileImage: "",
          authorChannelUrl: "",
          authorChannelId: "UCcharlie",
          text: "Nice",
          likeCount: 50,
          publishedAt: new Date(),
          updatedAt: new Date(),
        },
        totalReplyCount: 0,
        canReply: true,
        isPublic: true,
      },
    ];

    const stats = getCommentStats("vid1", threads);

    expect(stats.videoId).toBe("vid1");
    expect(stats.totalComments).toBe(2);
    expect(stats.totalReplies).toBe(1);
    expect(stats.uniqueAuthors).toBe(3);
    expect(stats.mostLikedComment!.authorName).toBe("Charlie");
    expect(stats.mostLikedComment!.likeCount).toBe(50);
    expect(stats.avgLikes).toBe(21.67);
    expect(stats.replyRatio).toBe(0.5);
  });

  it("handles empty threads", () => {
    const stats = getCommentStats("vid1", []);

    expect(stats.totalComments).toBe(0);
    expect(stats.totalReplies).toBe(0);
    expect(stats.uniqueAuthors).toBe(0);
    expect(stats.mostLikedComment).toBeNull();
    expect(stats.avgLikes).toBe(0);
    expect(stats.replyRatio).toBe(0);
  });
});

describe("flattenComments", () => {
  it("flattens threads into a single array", () => {
    const threads: CommentThread[] = [
      {
        id: "t1",
        videoId: "vid1",
        channelId: "ch1",
        topLevelComment: {
          id: "c1",
          authorName: "Alice",
          authorProfileImage: "",
          authorChannelUrl: "",
          authorChannelId: "UCalice",
          text: "Great",
          likeCount: 10,
          publishedAt: new Date(),
          updatedAt: new Date(),
        },
        totalReplyCount: 1,
        canReply: true,
        isPublic: true,
        replies: [
          {
            id: "r1",
            authorName: "Bob",
            authorProfileImage: "",
            authorChannelUrl: "",
            authorChannelId: "UCbob",
            text: "Thanks",
            likeCount: 5,
            publishedAt: new Date(),
            updatedAt: new Date(),
            parentId: "c1",
          },
        ],
      },
      {
        id: "t2",
        videoId: "vid1",
        channelId: "ch1",
        topLevelComment: {
          id: "c2",
          authorName: "Charlie",
          authorProfileImage: "",
          authorChannelUrl: "",
          authorChannelId: "UCcharlie",
          text: "Nice",
          likeCount: 50,
          publishedAt: new Date(),
          updatedAt: new Date(),
        },
        totalReplyCount: 0,
        canReply: true,
        isPublic: true,
      },
    ];

    const flat = flattenComments(threads);

    expect(flat).toHaveLength(3);
    expect(flat[0].authorName).toBe("Alice");
    expect(flat[1].authorName).toBe("Bob");
    expect(flat[2].authorName).toBe("Charlie");
  });
});

describe("CommentQueryBuilder", () => {
  it("builds and executes a query with options", async () => {
    const http = createMockHttp({ commentThreads: SINGLE_PAGE });
    const result = await new CommentQueryBuilder(http, "dQw4w9WgXcQ")
      .order("relevance")
      .limit(10)
      .execute();

    expect(result.videoId).toBe("dQw4w9WgXcQ");
    expect(result.threads).toHaveLength(2);
    expect(result.stats.totalComments).toBe(2);
    expect(result.totalResults).toBe(2);
  });

  it("applies limit to results", async () => {
    const http = createMockHttp({ commentThreads: SINGLE_PAGE });
    const result = await new CommentQueryBuilder(http, "dQw4w9WgXcQ").limit(1).execute();

    expect(result.threads).toHaveLength(1);
  });

  it("passes search terms", async () => {
    const http = createMockHttp({ commentThreads: SINGLE_PAGE });
    await new CommentQueryBuilder(http, "dQw4w9WgXcQ").search("love this").execute();

    expect(http.get).toHaveBeenCalledWith(
      "commentThreads",
      expect.objectContaining({
        searchTerms: "love this",
      })
    );
  });

  it("fetches all replies when withAllReplies is set", async () => {
    const threadWithMissing = {
      ...THREAD_1,
      replies: undefined,
      snippet: { ...THREAD_1.snippet, totalReplyCount: 1 },
    };
    const http = new HttpClient({ apiKey: "test-key" });

    vi.spyOn(http, "get").mockImplementation(async (path: string) => {
      if (path === "commentThreads") return { items: [threadWithMissing] };
      if (path === "comments") return REPLY_PAGE;
      throw new Error(`Unexpected path: ${path}`);
    });

    const result = await new CommentQueryBuilder(http, "dQw4w9WgXcQ").withAllReplies().execute();

    expect(result.threads[0].replies).toHaveLength(1);
    expect(result.threads[0].replies![0].authorName).toBe("Bob");
  });

  it("resolves video URLs", async () => {
    const http = createMockHttp({ commentThreads: SINGLE_PAGE });
    const result = await new CommentQueryBuilder(http, "https://youtu.be/dQw4w9WgXcQ").execute();

    expect(result.videoId).toBe("dQw4w9WgXcQ");
  });
});
