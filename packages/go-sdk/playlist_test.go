package lyra

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
)

func TestPlaylistPagesAndDuration(t *testing.T) {
	var itemCalls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/playlists":
			if r.URL.Query().Get("id") != "PLxxx" {
				writeJSON(t, w, map[string]any{"items": []any{}})
				return
			}
			writeJSON(t, w, map[string]any{
				"items": []any{
					map[string]any{
						"id": "PLxxx",
						"snippet": map[string]any{
							"title":       "Mix",
							"description": "A mix",
							"thumbnails": map[string]any{
								"default": map[string]any{"url": "https://img.example/pl.jpg", "width": 120, "height": 90},
							},
						},
					},
				},
			})
		case "/playlistItems":
			if r.URL.Query().Get("part") != "contentDetails" {
				t.Errorf("part = %s", r.URL.Query().Get("part"))
			}
			call := itemCalls.Add(1)
			if call == 1 {
				writeJSON(t, w, map[string]any{
					"nextPageToken": "page-2",
					"items": []any{
						map[string]any{"contentDetails": map[string]string{"videoId": "one"}},
					},
				})
				return
			}
			if r.URL.Query().Get("pageToken") != "page-2" {
				t.Errorf("pageToken = %s", r.URL.Query().Get("pageToken"))
			}
			writeJSON(t, w, map[string]any{
				"items": []any{
					map[string]any{"contentDetails": map[string]string{"videoId": "two"}},
				},
			})
		case "/videos":
			writeJSON(t, w, map[string]any{
				"items": []any{
					playlistVideo("one", "100", "PT1H"),
					playlistVideo("two", "50", "PT30M"),
				},
			})
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	client := testClient(t, server.URL)
	playlist, err := client.Playlist(context.Background(), "https://www.youtube.com/playlist?list=PLxxx")
	if err != nil {
		t.Fatal(err)
	}
	if playlist.ID != "PLxxx" || playlist.Title != "Mix" || playlist.VideoCount != 2 {
		t.Fatalf("playlist = %+v", playlist)
	}
	if playlist.TotalDuration != 5400 || playlist.TotalDurationFmt != "1h 30m" {
		t.Fatalf("duration = %d %s", playlist.TotalDuration, playlist.TotalDurationFmt)
	}
	if itemCalls.Load() != 2 {
		t.Fatalf("item calls = %d", itemCalls.Load())
	}

	_, err = client.PlaylistInfo(context.Background(), "missing")
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("err = %v", err)
	}
}

func TestPlaylistQueryFilterSortAndSlice(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/playlists":
			writeJSON(t, w, map[string]any{
				"items": []any{
					map[string]any{
						"id": "PLquery",
						"snippet": map[string]any{
							"title":       "Query",
							"description": "",
						},
					},
				},
			})
		case "/playlistItems":
			writeJSON(t, w, map[string]any{
				"items": []any{
					map[string]any{"contentDetails": map[string]string{"videoId": "low"}},
					map[string]any{"contentDetails": map[string]string{"videoId": "mid"}},
					map[string]any{"contentDetails": map[string]string{"videoId": "high"}},
				},
			})
		case "/videos":
			writeJSON(t, w, map[string]any{
				"items": []any{
					playlistVideo("low", "100", "PT1M"),
					playlistVideo("mid", "20000", "PT2M"),
					playlistVideo("high", "50000", "PT3M"),
				},
			})
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	client := testClient(t, server.URL)
	result, err := client.PlaylistQuery("PLquery").
		FilterByViews(10_000, 0).
		SortBy("views", "desc").
		Between(1, 1).
		Execute(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if result.OriginalCount != 3 || result.VideoCount != 1 || result.Videos[0].ID != "high" {
		t.Fatalf("result = %+v", result)
	}
}

func TestPlaylistKeepsRepeatedVideos(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/playlists":
			writeJSON(t, w, map[string]any{
				"items": []any{
					map[string]any{
						"id":      "PLdup",
						"snippet": map[string]any{"title": "Dup", "description": ""},
					},
				},
			})
		case "/playlistItems":
			writeJSON(t, w, map[string]any{
				"items": []any{
					map[string]any{"contentDetails": map[string]string{"videoId": "a"}},
					map[string]any{"contentDetails": map[string]string{"videoId": "a"}},
				},
			})
		case "/videos":
			writeJSON(t, w, map[string]any{
				"items": []any{playlistVideo("a", "10", "PT1M")},
			})
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	client := testClient(t, server.URL)
	playlist, err := client.Playlist(context.Background(), "PLdup")
	if err != nil {
		t.Fatal(err)
	}
	if playlist.VideoCount != 2 || playlist.TotalDuration != 120 {
		t.Fatalf("count=%d duration=%d", playlist.VideoCount, playlist.TotalDuration)
	}
	if playlist.Videos[0].ID != "a" || playlist.Videos[1].ID != "a" {
		t.Fatalf("videos = %+v", playlist.Videos)
	}
}

func TestPlaylistQueryReplacesDurationBounds(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/playlists":
			writeJSON(t, w, map[string]any{
				"items": []any{
					map[string]any{
						"id":      "PLbounds",
						"snippet": map[string]any{"title": "Bounds", "description": ""},
					},
				},
			})
		case "/playlistItems":
			writeJSON(t, w, map[string]any{
				"items": []any{
					map[string]any{"contentDetails": map[string]string{"videoId": "short"}},
					map[string]any{"contentDetails": map[string]string{"videoId": "long"}},
				},
			})
		case "/videos":
			writeJSON(t, w, map[string]any{
				"items": []any{
					playlistVideo("short", "1", "PT1M30S"),
					playlistVideo("long", "1", "PT6M40S"),
				},
			})
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	client := testClient(t, server.URL)
	result, err := client.PlaylistQuery("PLbounds").
		FilterByDuration(60, 120).
		FilterByDuration(300, 0).
		Execute(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if result.VideoCount != 1 || result.Videos[0].ID != "long" {
		t.Fatalf("result = %+v", result)
	}
}

func playlistVideo(id, views, duration string) map[string]any {
	return map[string]any{
		"id": id,
		"snippet": map[string]any{
			"title":        "Video " + id,
			"description":  "",
			"channelTitle": "Channel",
			"publishedAt":  "2024-01-15T12:00:00Z",
		},
		"statistics": map[string]string{
			"viewCount": views,
			"likeCount": "1",
		},
		"contentDetails": map[string]string{"duration": duration},
	}
}
