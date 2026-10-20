package lyra

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

func TestNewRejectsEmptyAPIKey(t *testing.T) {
	_, err := New("")
	if err == nil {
		t.Fatal("expected error")
	}
}

func TestTransportRetriesThenSucceeds(t *testing.T) {
	var calls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("key") != "test-key" {
			t.Errorf("key = %q", r.URL.Query().Get("key"))
		}
		if calls.Add(1) == 1 {
			http.Error(w, "temporary", http.StatusInternalServerError)
			return
		}
		writeJSON(t, w, map[string]any{"items": []any{map[string]string{"id": "abc"}}})
	}))
	defer server.Close()

	client := testClient(t, server.URL, WithMaxRetries(1))
	data, err := getJSON[struct {
		Items []struct{ ID string }
	}](context.Background(), client.http, "videos", map[string]string{"id": "abc"})
	if err != nil {
		t.Fatal(err)
	}
	if data.Items[0].ID != "abc" {
		t.Fatalf("id = %q", data.Items[0].ID)
	}
	if calls.Load() != 2 {
		t.Fatalf("calls = %d", calls.Load())
	}
}

func TestTransportMapsAuthQuotaAndNotFound(t *testing.T) {
	tests := []struct {
		name   string
		status int
		body   string
		want   error
	}{
		{name: "auth key", status: http.StatusForbidden, body: "bad API key", want: ErrAuth},
		{name: "quota", status: http.StatusForbidden, body: "quotaExceeded", want: ErrQuota},
		{name: "unauthorized", status: http.StatusUnauthorized, body: "nope", want: ErrAuth},
		{name: "missing", status: http.StatusNotFound, body: "missing", want: ErrNotFound},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				http.Error(w, tt.body, tt.status)
			}))
			defer server.Close()

			client := testClient(t, server.URL, WithMaxRetries(2))
			_, err := getJSON[map[string]any](context.Background(), client.http, "videos", map[string]string{"id": "abc"})
			if !errors.Is(err, tt.want) {
				t.Fatalf("err = %v", err)
			}
		})
	}
}

func TestTransportDoesNotRetryNotFound(t *testing.T) {
	var calls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		http.Error(w, "missing", http.StatusNotFound)
	}))
	defer server.Close()

	client := testClient(t, server.URL, WithMaxRetries(2))
	_, err := getJSON[map[string]any](context.Background(), client.http, "videos", map[string]string{"id": "abc"})
	var api *Error
	if !errors.As(err, &api) || api.Message != "Video not found: abc" {
		t.Fatalf("err = %v", err)
	}
	if calls.Load() != 1 {
		t.Fatalf("calls = %d", calls.Load())
	}
}

func TestTransportContextCancel(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		<-r.Context().Done()
	}))
	defer server.Close()

	client := testClient(t, server.URL)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Millisecond)
	defer cancel()
	_, err := getJSON[map[string]any](ctx, client.http, "videos", map[string]string{"id": "abc"})
	if !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("err = %v", err)
	}
}

func TestTransportKeepsRetryCause(t *testing.T) {
	sentinel := errors.New("dial failed")
	client, err := New("test-key", WithMaxRetries(0), WithHTTPClient(&http.Client{
		Transport: roundTripperFunc(func(*http.Request) (*http.Response, error) {
			return nil, sentinel
		}),
	}))
	if err != nil {
		t.Fatal(err)
	}
	_, err = getJSON[map[string]any](context.Background(), client.http, "videos", map[string]string{"id": "abc"})
	if !errors.Is(err, sentinel) {
		t.Fatalf("err = %v", err)
	}
}

type roundTripperFunc func(*http.Request) (*http.Response, error)

func (f roundTripperFunc) RoundTrip(r *http.Request) (*http.Response, error) {
	return f(r)
}

func TestVideoURLAndNotFound(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/videos" {
			t.Fatalf("path = %s", r.URL.Path)
		}
		if r.URL.Query().Get("id") != "dQw4w9WgXcQ" {
			http.Error(w, "missing", http.StatusNotFound)
			return
		}
		if r.URL.Query().Get("part") != "snippet,statistics,contentDetails" {
			t.Fatalf("part = %s", r.URL.Query().Get("part"))
		}
		writeJSON(t, w, videoList("dQw4w9WgXcQ", "Direct Channel"))
	}))
	defer server.Close()

	client := testClient(t, server.URL)
	video, err := client.Video(context.Background(), "https://www.youtube.com/watch?v=dQw4w9WgXcQ")
	if err != nil {
		t.Fatal(err)
	}
	if video.Channel != "Direct Channel" || video.Title != "Video dQw4w9WgXcQ" {
		t.Fatalf("video = %+v", video)
	}
	if video.Duration != 210 || video.DurationFmt != "3:30" {
		t.Fatalf("duration = %d %s", video.Duration, video.DurationFmt)
	}
	if video.Views != 1500000 || video.ViewsFmt != "1.5M" {
		t.Fatalf("views = %d %s", video.Views, video.ViewsFmt)
	}
	if video.Published != "January 15, 2024" {
		t.Fatalf("published = %s", video.Published)
	}

	_, err = client.Video(context.Background(), "missing-id")
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("err = %v", err)
	}
}

func TestVideosChunksAndTitles(t *testing.T) {
	var calls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		ids := splitCSV(r.URL.Query().Get("id"))
		if len(ids) > youtubeMaxResults {
			t.Fatalf("chunk size %d", len(ids))
		}
		items := make([]map[string]any, 0, len(ids))
		for _, id := range ids {
			if id == "gone" {
				continue
			}
			items = append(items, videoResource(id, "Channel "+id))
		}
		writeJSON(t, w, map[string]any{"items": items})
	}))
	defer server.Close()

	ids := make([]string, 51)
	for i := range ids {
		ids[i] = "v" + itoa(i)
	}
	ids = append(ids, "https://youtu.be/bareShort")
	client := testClient(t, server.URL)

	videos, err := client.Videos(context.Background(), ids)
	if err != nil {
		t.Fatal(err)
	}
	if len(videos) != 52 {
		t.Fatalf("len = %d", len(videos))
	}
	if videos[51].ID != "bareShort" || videos[51].Channel != "Channel bareShort" {
		t.Fatalf("last = %+v", videos[51])
	}
	if calls.Load() != 2 {
		t.Fatalf("calls = %d", calls.Load())
	}

	calls.Store(0)
	title, err := client.VideoTitle(context.Background(), "gone")
	if err != nil {
		t.Fatal(err)
	}
	if title != "Video gone" {
		t.Fatalf("title = %q", title)
	}

	titles, err := client.VideoTitles(context.Background(), []string{"v0", "gone"})
	if err != nil {
		t.Fatal(err)
	}
	if titles["v0"] != "Video v0" || titles["gone"] != "Video gone" {
		t.Fatalf("titles = %#v", titles)
	}
}

func TestChannelResolveAndUploads(t *testing.T) {
	const channelID = "UCX6OQ3DkcsbYNE6H8uQQuVA"
	var searchCalls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/channels":
			if handle := r.URL.Query().Get("forHandle"); handle != "" {
				if handle == "@legacyname" {
					writeJSON(t, w, map[string]any{"items": []any{}})
					return
				}
				writeJSON(t, w, map[string]any{"items": []any{map[string]string{"id": channelID}}})
				return
			}
			if id := r.URL.Query().Get("id"); id != "" && id != channelID {
				writeJSON(t, w, map[string]any{"items": []any{}})
				return
			}
			writeJSON(t, w, channelBody(channelID))
		case "/search":
			searchCalls.Add(1)
			writeJSON(t, w, map[string]any{
				"items": []any{map[string]any{"snippet": map[string]string{"channelId": channelID}}},
			})
		case "/playlistItems":
			if r.URL.Query().Get("maxResults") != "5" && r.URL.Query().Get("maxResults") != "50" {
				t.Fatalf("maxResults = %s", r.URL.Query().Get("maxResults"))
			}
			writeJSON(t, w, map[string]any{
				"items": []any{
					map[string]any{
						"snippet": map[string]any{
							"title":       "Upload",
							"publishedAt": time.Now().Add(-48 * time.Hour).UTC().Format(time.RFC3339),
							"resourceId":  map[string]string{"videoId": "vid1"},
							"thumbnails": map[string]any{
								"high": map[string]any{"url": "https://img.example/high.jpg", "width": 480, "height": 360},
							},
						},
					},
				},
			})
		case "/videos":
			writeJSON(t, w, map[string]any{
				"items": []any{
					map[string]any{
						"id": "vid1",
						"statistics": map[string]string{
							"viewCount": "1000",
							"likeCount": "10",
						},
						"contentDetails": map[string]string{"duration": "PT1M5S"},
					},
				},
			})
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	client := testClient(t, server.URL)
	channel, err := client.Channel(context.Background(), "@testchannel")
	if err != nil {
		t.Fatal(err)
	}
	if channel.ID != channelID || channel.Username != "@testchannel" || channel.Country != "US" {
		t.Fatalf("channel = %+v", channel)
	}
	if searchCalls.Load() != 0 {
		t.Fatalf("search calls = %d", searchCalls.Load())
	}

	legacy, err := client.Channel(context.Background(), "@legacyname")
	if err != nil {
		t.Fatal(err)
	}
	if legacy.ID != channelID || searchCalls.Load() != 1 {
		t.Fatalf("legacy = %+v search=%d", legacy, searchCalls.Load())
	}

	custom, err := client.Channel(context.Background(), "https://www.youtube.com/c/SomeName")
	if err != nil {
		t.Fatal(err)
	}
	if custom.ID != channelID {
		t.Fatalf("custom = %+v", custom)
	}

	_, err = client.Channel(context.Background(), "UCxxxxxxxxxxxxxxxxxxxxxx")
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("err = %v", err)
	}

	recent, err := client.ChannelVideos(context.Background(), channelID, 80)
	if err != nil {
		t.Fatal(err)
	}
	if len(recent) != 1 || recent[0].ID != "vid1" || recent[0].DurationFmt != "1:05" {
		t.Fatalf("recent = %+v", recent)
	}
	if recent[0].Thumbnail != "https://img.example/high.jpg" || recent[0].UploadAge != "2 days ago" {
		t.Fatalf("recent meta = %+v", recent[0])
	}
}

func testClient(t *testing.T, baseURL string, opts ...Option) *Client {
	t.Helper()
	opts = append([]Option{WithBaseURL(baseURL), WithMaxRetries(0)}, opts...)
	client, err := New("test-key", opts...)
	if err != nil {
		t.Fatal(err)
	}
	return client
}

func writeJSON(t *testing.T, w http.ResponseWriter, body any) {
	t.Helper()
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(body); err != nil {
		t.Fatal(err)
	}
}

func videoList(id, channel string) map[string]any {
	return map[string]any{"items": []any{videoResource(id, channel)}}
}

func videoResource(id, channel string) map[string]any {
	return map[string]any{
		"id": id,
		"snippet": map[string]any{
			"title":        "Video " + id,
			"description":  "Description " + id,
			"channelId":    "UC123",
			"channelTitle": channel,
			"publishedAt":  "2024-01-15T12:00:00Z",
			"thumbnails": map[string]any{
				"default": map[string]any{"url": "https://img.youtube.com/default.jpg", "width": 120, "height": 90},
				"high":    map[string]any{"url": "https://img.youtube.com/high.jpg", "width": 480, "height": 360},
			},
		},
		"statistics": map[string]string{
			"viewCount":    "1500000",
			"likeCount":    "100",
			"commentCount": "10",
		},
		"contentDetails": map[string]string{"duration": "PT3M30S"},
	}
}

func channelBody(id string) map[string]any {
	return map[string]any{
		"items": []any{
			map[string]any{
				"id": id,
				"snippet": map[string]any{
					"title":     "Test Channel",
					"customUrl": "@testchannel",
					"country":   "US",
					"thumbnails": map[string]any{
						"default": map[string]any{"url": "https://img.youtube.com/default.jpg", "width": 120, "height": 90},
					},
				},
				"statistics": map[string]string{
					"subscriberCount": "1000",
					"viewCount":       "2000",
					"videoCount":      "10",
				},
				"contentDetails": map[string]any{
					"relatedPlaylists": map[string]string{"uploads": "UUuploads"},
				},
			},
		},
	}
}

func splitCSV(s string) []string {
	if s == "" {
		return nil
	}
	out := []string{}
	start := 0
	for i := 0; i <= len(s); i++ {
		if i == len(s) || s[i] == ',' {
			out = append(out, s[start:i])
			start = i + 1
		}
	}
	return out
}
