package lyra

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestChannelVideosMissingDurationIsZero(t *testing.T) {
	const channelID = "UCX6OQ3DkcsbYNE6H8uQQuVA"
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/channels":
			writeJSON(t, w, channelBody(channelID))
		case "/playlistItems":
			writeJSON(t, w, map[string]any{
				"items": []any{map[string]any{
					"snippet": map[string]any{
						"title":       "Live stream",
						"publishedAt": time.Now().UTC().Format(time.RFC3339),
						"resourceId":  map[string]string{"videoId": "live1"},
					},
				}},
			})
		case "/videos":
			writeJSON(t, w, map[string]any{
				"items": []any{map[string]any{
					"id":         "live1",
					"statistics": map[string]string{"viewCount": "7"},
				}},
			})
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	recent, err := testClient(t, server.URL).ChannelVideos(context.Background(), channelID, 1)
	if err != nil {
		t.Fatal(err)
	}
	if len(recent) != 1 {
		t.Fatalf("recent = %+v", recent)
	}
	if recent[0].Duration != 0 || recent[0].DurationFmt != "0:00" {
		t.Fatalf("duration = %v fmt = %q", recent[0].Duration, recent[0].DurationFmt)
	}
}
