package lyra

import (
	"context"
	"strings"
	"time"

	"golang.org/x/sync/errgroup"

	"github.com/abhisek-1221/lyra-sdk/packages/go-sdk/internal/youtube"
)

const (
	youtubeMaxResults = 50
	maxParallelChunks = 4
)

// Video fetches one video by URL or id.
func (c *Client) Video(ctx context.Context, urlOrID string) (Video, error) {
	id := resolveVideoID(urlOrID)
	data, err := getJSON[youtube.VideoList](ctx, c.http, "videos", map[string]string{
		"part": "snippet,statistics,contentDetails",
		"id":   id,
	})
	if err != nil {
		return Video{}, err
	}
	if len(data.Items) == 0 {
		return Video{}, notFound("Video", id)
	}
	return mapVideo(data.Items[0]), nil
}

// Videos fetches many videos. IDs are split into groups of 50 and requested
// with at most four calls in flight.
func (c *Client) Videos(ctx context.Context, urlsOrIDs []string) ([]Video, error) {
	ids := resolveIDs(urlsOrIDs)
	chunks := chunkStrings(ids, youtubeMaxResults)
	lists := make([]youtube.VideoList, len(chunks))

	group, ctx := errgroup.WithContext(ctx)
	group.SetLimit(maxParallelChunks)
	for i, part := range chunks {
		group.Go(func() error {
			data, err := getJSON[youtube.VideoList](ctx, c.http, "videos", map[string]string{
				"part": "snippet,statistics,contentDetails",
				"id":   strings.Join(part, ","),
			})
			if err != nil {
				return err
			}
			lists[i] = data
			return nil
		})
	}
	if err := group.Wait(); err != nil {
		return nil, err
	}

	videos := make([]Video, 0)
	for _, list := range lists {
		for _, item := range list.Items {
			videos = append(videos, mapVideo(item))
		}
	}
	return videos, nil
}

// VideoTitle returns the title for one video. A missing video yields "Video {id}".
func (c *Client) VideoTitle(ctx context.Context, urlOrID string) (string, error) {
	id := resolveVideoID(urlOrID)
	data, err := getJSON[youtube.VideoList](ctx, c.http, "videos", map[string]string{
		"part": "snippet",
		"id":   id,
	})
	if err != nil {
		return "", err
	}
	if len(data.Items) == 0 {
		return "Video " + id, nil
	}
	return data.Items[0].Snippet.Title, nil
}

// VideoTitles returns titles keyed by video id. Missing ids map to "Video {id}".
func (c *Client) VideoTitles(ctx context.Context, urlsOrIDs []string) (map[string]string, error) {
	ids := resolveIDs(urlsOrIDs)
	chunks := chunkStrings(ids, youtubeMaxResults)
	lists := make([]youtube.VideoList, len(chunks))

	group, ctx := errgroup.WithContext(ctx)
	group.SetLimit(maxParallelChunks)
	for i, part := range chunks {
		group.Go(func() error {
			data, err := getJSON[youtube.VideoList](ctx, c.http, "videos", map[string]string{
				"part": "snippet",
				"id":   strings.Join(part, ","),
			})
			if err != nil {
				return err
			}
			lists[i] = data
			return nil
		})
	}
	if err := group.Wait(); err != nil {
		return nil, err
	}

	titles := make(map[string]string, len(ids))
	for _, list := range lists {
		for _, item := range list.Items {
			titles[item.ID] = item.Snippet.Title
		}
	}
	for _, id := range ids {
		if _, ok := titles[id]; !ok {
			titles[id] = "Video " + id
		}
	}
	return titles, nil
}

func resolveIDs(urlsOrIDs []string) []string {
	ids := make([]string, len(urlsOrIDs))
	for i, raw := range urlsOrIDs {
		ids[i] = resolveVideoID(raw)
	}
	return ids
}

func chunkStrings(ids []string, size int) [][]string {
	if len(ids) == 0 {
		return nil
	}
	chunks := make([][]string, 0, (len(ids)+size-1)/size)
	for start := 0; start < len(ids); start += size {
		end := start + size
		if end > len(ids) {
			end = len(ids)
		}
		chunks = append(chunks, ids[start:end])
	}
	return chunks
}

func mapVideo(item youtube.Video) Video {
	views := parseCount(item.Statistics.ViewCount)
	likes := parseCount(item.Statistics.LikeCount)
	comments := parseCount(item.Statistics.CommentCount)
	duration := ParseDuration(item.ContentDetails.Duration)
	publishedAt := parseTime(item.Snippet.PublishedAt)
	return Video{
		ID:          item.ID,
		Title:       item.Snippet.Title,
		Description: item.Snippet.Description,
		Channel:     item.Snippet.ChannelTitle,
		ChannelID:   item.Snippet.ChannelID,
		Views:       views,
		ViewsFmt:    FormatNumber(views),
		Likes:       likes,
		LikesFmt:    FormatNumber(likes),
		Comments:    comments,
		CommentsFmt: FormatNumber(comments),
		Duration:    duration,
		DurationFmt: FormatDurationClock(duration),
		Published:   FormatDate(item.Snippet.PublishedAt),
		PublishedAt: publishedAt,
		Thumbnails:  mapThumbnails(item.Snippet.Thumbnails),
	}
}

func parseTime(iso string) time.Time {
	parsed, err := time.Parse(time.RFC3339, iso)
	if err != nil {
		parsed, err = time.Parse(time.RFC3339Nano, iso)
	}
	if err != nil {
		return time.Time{}
	}
	return parsed
}
