package lyra

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestVideosPublishTimestamps(t *testing.T) {
	stamps := map[string]string{
		"frac":    "2024-01-15T12:00:00.123456Z",
		"offset":  "2024-01-15T23:30:00-05:00",
		"invalid": "not a time",
	}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		items := []any{}
		for _, id := range splitCSV(r.URL.Query().Get("id")) {
			resource := videoResource(id, "Channel")
			resource["snippet"].(map[string]any)["publishedAt"] = stamps[id]
			items = append(items, resource)
		}
		writeJSON(t, w, map[string]any{"items": items})
	}))
	defer server.Close()

	client := testClient(t, server.URL)
	videos, err := client.Videos(context.Background(), []string{"frac", "offset", "invalid"})
	if err != nil {
		t.Fatal(err)
	}
	if len(videos) != 3 {
		t.Fatalf("videos = %d", len(videos))
	}

	want := []struct {
		published string
		at        time.Time
	}{
		{"January 15, 2024", time.Date(2024, 1, 15, 12, 0, 0, 123456000, time.UTC)},
		{"January 16, 2024", time.Date(2024, 1, 16, 4, 30, 0, 0, time.UTC)},
		{"Invalid Date", time.Time{}},
	}
	for i, w := range want {
		got := videos[i]
		if got.Published != w.published {
			t.Errorf("%s: published = %q, want %q", got.ID, got.Published, w.published)
		}
		if !got.PublishedAt.Equal(w.at) {
			t.Errorf("%s: publishedAt = %v, want %v", got.ID, got.PublishedAt, w.at)
		}
	}
}
