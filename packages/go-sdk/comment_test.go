package lyra

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
)

func TestCommentsStopsAtMaxResults(t *testing.T) {
	var calls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/commentThreads" {
			http.NotFound(w, r)
			return
		}
		calls.Add(1)
		if r.URL.Query().Get("videoId") != "vid" {
			t.Errorf("videoId = %s", r.URL.Query().Get("videoId"))
		}
		writeJSON(t, w, map[string]any{
			"nextPageToken": "next",
			"items": []any{
				commentThread("t1", "c1", 0, nil),
				commentThread("t2", "c2", 0, nil),
			},
		})
	}))
	defer server.Close()

	client := testClient(t, server.URL)
	threads, err := client.Comments(context.Background(), "https://youtu.be/vid", CommentOptions{MaxResults: 2})
	if err != nil {
		t.Fatal(err)
	}
	if len(threads) != 2 || calls.Load() != 1 {
		t.Fatalf("len=%d calls=%d", len(threads), calls.Load())
	}
	if threads[0].TopLevelComment.Text != "plain c1" {
		t.Fatalf("text = %q", threads[0].TopLevelComment.Text)
	}
}

func TestCommentRepliesPages(t *testing.T) {
	var calls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		if r.URL.Query().Get("pageToken") == "" {
			writeJSON(t, w, map[string]any{
				"nextPageToken": "p2",
				"items":         []any{commentResource("r1", "parent")},
			})
			return
		}
		writeJSON(t, w, map[string]any{
			"items": []any{commentResource("r2", "parent")},
		})
	}))
	defer server.Close()

	client := testClient(t, server.URL)
	replies, err := client.CommentReplies(context.Background(), "parent", "plainText")
	if err != nil {
		t.Fatal(err)
	}
	if len(replies) != 2 || calls.Load() != 2 || replies[1].ParentID != "parent" {
		t.Fatalf("replies=%+v calls=%d", replies, calls.Load())
	}
}

func TestCommentsHydrateStatsAndQuery(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/commentThreads":
			if r.URL.Query().Get("searchTerms") == "love" && r.URL.Query().Get("maxResults") != "1" {
				t.Errorf("query params = %s", r.URL.RawQuery)
			}
			writeJSON(t, w, map[string]any{
				"items": []any{
					commentThread("t1", "c1", 2, []any{commentResource("r1", "c1")}),
				},
			})
		case "/comments":
			writeJSON(t, w, map[string]any{
				"items": []any{
					commentResource("r1", "c1"),
					commentResource("r2", "c1"),
				},
			})
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	client := testClient(t, server.URL)
	ctx := context.Background()
	threads, err := client.CommentsWithReplies(ctx, "vid", CommentOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if len(threads) != 1 || len(threads[0].Replies) != 2 {
		t.Fatalf("threads = %+v", threads)
	}
	stats := client.CommentStats("vid", []CommentThread{{
		TotalReplyCount: 3,
		TopLevelComment: Comment{AuthorChannelID: "a", LikeCount: 1},
		Replies:         []Comment{{AuthorChannelID: "b", LikeCount: 4}},
	}})
	if stats.TotalComments != 1 || stats.TotalReplies != 3 || stats.UniqueAuthors != 2 {
		t.Fatalf("stats = %+v", stats)
	}
	if stats.MostLikedComment == nil || stats.MostLikedComment.LikeCount != 4 {
		t.Fatalf("most liked = %+v", stats.MostLikedComment)
	}
	flat := client.FlattenComments(threads)
	if len(flat) != 3 {
		t.Fatalf("flat = %d", len(flat))
	}

	result, err := client.CommentQuery("https://www.youtube.com/watch?v=vid").
		Search("love").
		Limit(1).
		WithAllReplies().
		Execute(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if result.TotalResults != 1 || len(result.Threads[0].Replies) != 2 {
		t.Fatalf("result = %+v", result)
	}
}

func commentThread(id, commentID string, replyCount int, replies []any) map[string]any {
	thread := map[string]any{
		"id": id,
		"snippet": map[string]any{
			"channelId":       "UC1",
			"videoId":         "vid",
			"topLevelComment": commentResource(commentID, ""),
			"canReply":        true,
			"totalReplyCount": replyCount,
			"isPublic":        true,
		},
	}
	if replies != nil {
		thread["replies"] = map[string]any{"comments": replies}
	}
	return thread
}

func commentResource(id, parent string) map[string]any {
	snippet := map[string]any{
		"authorDisplayName":     "Ada",
		"authorProfileImageUrl": "https://img.example/a.jpg",
		"authorChannelUrl":      "https://www.youtube.com/channel/UC1",
		"authorChannelId":       map[string]string{"value": "UC1"},
		"textDisplay":           "html " + id,
		"textOriginal":          "plain " + id,
		"likeCount":             1,
		"publishedAt":           "2024-01-15T12:00:00Z",
		"updatedAt":             "2024-01-15T12:00:00Z",
	}
	if parent != "" {
		snippet["parentId"] = parent
	}
	return map[string]any{"id": id, "snippet": snippet}
}
