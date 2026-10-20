package lyra

import (
	"context"
	"strings"

	"golang.org/x/sync/errgroup"

	"github.com/abhisek-1221/lyra-sdk/packages/go-sdk/internal/youtube"
)

// PlaylistInfo fetches playlist metadata. urlOrID may be a URL or a bare id.
func (c *Client) PlaylistInfo(ctx context.Context, urlOrID string) (PlaylistInfo, error) {
	return c.playlistInfo(ctx, resolvePlaylistID(urlOrID))
}

// PlaylistVideoIDs returns every video id in a playlist. Pages are requested in order.
func (c *Client) PlaylistVideoIDs(ctx context.Context, urlOrID string) ([]string, error) {
	return c.playlistVideoIDs(ctx, resolvePlaylistID(urlOrID))
}

// Playlist fetches metadata, every video id, and full details for those videos.
// Metadata and id paging start together. Detail requests run in chunks of 50.
func (c *Client) Playlist(ctx context.Context, urlOrID string) (Playlist, error) {
	id := resolvePlaylistID(urlOrID)

	var info PlaylistInfo
	var ids []string
	group, groupCtx := errgroup.WithContext(ctx)
	group.Go(func() error {
		var err error
		info, err = c.playlistInfo(groupCtx, id)
		return err
	})
	group.Go(func() error {
		var err error
		ids, err = c.playlistVideoIDs(groupCtx, id)
		return err
	})
	if err := group.Wait(); err != nil {
		return Playlist{}, err
	}

	videos, err := c.playlistVideos(ctx, ids)
	if err != nil {
		return Playlist{}, err
	}
	total := totalDuration(videos)
	return Playlist{
		ID:               info.ID,
		Title:            info.Title,
		Description:      info.Description,
		Thumbnails:       info.Thumbnails,
		VideoCount:       len(videos),
		TotalDuration:    total,
		TotalDurationFmt: FormatDuration(total),
		Videos:           videos,
	}, nil
}

func (c *Client) playlistInfo(ctx context.Context, id string) (PlaylistInfo, error) {
	data, err := getJSON[youtube.PlaylistList](ctx, c.http, "playlists", map[string]string{
		"part": "snippet",
		"id":   id,
	})
	if err != nil {
		return PlaylistInfo{}, err
	}
	if len(data.Items) == 0 {
		return PlaylistInfo{}, notFound("Playlist", id)
	}
	item := data.Items[0]
	return PlaylistInfo{
		ID:          item.ID,
		Title:       item.Snippet.Title,
		Description: item.Snippet.Description,
		Thumbnails:  mapThumbnails(item.Snippet.Thumbnails),
	}, nil
}

func (c *Client) playlistVideoIDs(ctx context.Context, playlistID string) ([]string, error) {
	var ids []string
	pageToken := ""
	for {
		params := map[string]string{
			"part":       "contentDetails",
			"playlistId": playlistID,
			"maxResults": itoa(youtubeMaxResults),
		}
		if pageToken != "" {
			params["pageToken"] = pageToken
		}
		page, err := getJSON[youtube.PlaylistItemPage](ctx, c.http, "playlistItems", params)
		if err != nil {
			return nil, err
		}
		if len(page.Items) == 0 {
			break
		}
		for _, item := range page.Items {
			ids = append(ids, item.ContentDetails.VideoID)
		}
		if page.NextPageToken == "" {
			break
		}
		pageToken = page.NextPageToken
	}
	if ids == nil {
		ids = []string{}
	}
	return ids, nil
}

func (c *Client) playlistVideos(ctx context.Context, ids []string) ([]PlaylistVideo, error) {
	if len(ids) == 0 {
		return []PlaylistVideo{}, nil
	}
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

	videos := make([]PlaylistVideo, 0)
	for _, list := range lists {
		for _, item := range list.Items {
			videos = append(videos, mapPlaylistVideo(item))
		}
	}
	return videos, nil
}

func mapPlaylistVideo(item youtube.Video) PlaylistVideo {
	duration := ParseDuration(item.ContentDetails.Duration)
	views := parseCount(item.Statistics.ViewCount)
	likes := parseCount(item.Statistics.LikeCount)
	return PlaylistVideo{
		ID:           item.ID,
		Title:        item.Snippet.Title,
		Description:  item.Snippet.Description,
		ChannelTitle: item.Snippet.ChannelTitle,
		PublishedAt:  parseTime(item.Snippet.PublishedAt),
		Duration:     duration,
		DurationFmt:  FormatDurationClock(duration),
		Views:        views,
		ViewsFmt:     FormatNumber(views),
		Likes:        likes,
		LikesFmt:     FormatNumber(likes),
		Thumbnails:   mapThumbnails(item.Snippet.Thumbnails),
	}
}

func totalDuration(videos []PlaylistVideo) int {
	total := 0
	for _, video := range videos {
		total += video.Duration
	}
	return total
}
