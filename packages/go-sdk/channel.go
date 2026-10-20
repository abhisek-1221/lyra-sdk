package lyra

import (
	"context"
	"strings"

	"github.com/abhisek-1221/lyra-sdk/packages/go-sdk/internal/youtube"
)

// Channel fetches channel metadata. input may be a channel id, @handle, or URL.
func (c *Client) Channel(ctx context.Context, urlOrID string) (Channel, error) {
	channelID, err := c.resolveChannelID(ctx, urlOrID)
	if err != nil {
		return Channel{}, err
	}
	return c.channelByID(ctx, channelID)
}

// ChannelVideos returns recent uploads. limit defaults to 5 and is capped at 50.
// The channel lookup, uploads page, and stats request run in order.
func (c *Client) ChannelVideos(ctx context.Context, urlOrID string, limit int) ([]RecentVideo, error) {
	if limit <= 0 {
		limit = 5
	}
	if limit > youtubeMaxResults {
		limit = youtubeMaxResults
	}

	channel, err := c.Channel(ctx, urlOrID)
	if err != nil {
		return nil, err
	}

	page, err := getJSON[youtube.PlaylistItemList](ctx, c.http, "playlistItems", map[string]string{
		"part":       "snippet",
		"playlistId": channel.UploadsPlaylistID,
		"maxResults": itoa(limit),
	})
	if err != nil {
		return nil, err
	}
	if len(page.Items) == 0 {
		return []RecentVideo{}, nil
	}

	ids := make([]string, len(page.Items))
	for i, item := range page.Items {
		ids[i] = item.Snippet.ResourceID.VideoID
	}
	stats, err := getJSON[youtube.VideoList](ctx, c.http, "videos", map[string]string{
		"part": "statistics,contentDetails",
		"id":   strings.Join(ids, ","),
	})
	if err != nil {
		return nil, err
	}

	byID := make(map[string]youtube.Video, len(stats.Items))
	for _, item := range stats.Items {
		byID[item.ID] = item
	}

	recent := make([]RecentVideo, 0, len(page.Items))
	for _, item := range page.Items {
		videoID := item.Snippet.ResourceID.VideoID
		stat := byID[videoID]
		views := parseCount(stat.Statistics.ViewCount)
		likes := parseCount(stat.Statistics.LikeCount)
		durationISO := stat.ContentDetails.Duration
		if durationISO == "" {
			durationISO = "PT0S"
		}
		duration := ParseDuration(durationISO)
		publishedAt := parseTime(item.Snippet.PublishedAt)
		recent = append(recent, RecentVideo{
			ID:          videoID,
			Title:       item.Snippet.Title,
			Views:       views,
			ViewsFmt:    FormatNumber(views),
			Likes:       likes,
			LikesFmt:    FormatNumber(likes),
			Duration:    duration,
			DurationFmt: FormatDurationClock(duration),
			Thumbnail:   recentThumbnail(item.Snippet.Thumbnails),
			UploadAge:   RelativeTime(publishedAt),
			PublishedAt: publishedAt,
		})
	}
	return recent, nil
}

func (c *Client) channelByID(ctx context.Context, channelID string) (Channel, error) {
	data, err := getJSON[youtube.ChannelList](ctx, c.http, "channels", map[string]string{
		"part": "snippet,statistics,contentDetails",
		"id":   channelID,
	})
	if err != nil {
		return Channel{}, err
	}
	if len(data.Items) == 0 {
		return Channel{}, notFound("Channel", channelID)
	}
	return mapChannel(data.Items[0]), nil
}

func (c *Client) resolveChannelID(ctx context.Context, input string) (string, error) {
	if bareChannelID.MatchString(input) {
		return input, nil
	}
	if id := ExtractChannelID(input); id != "" {
		return id, nil
	}

	username := ExtractUsername(input)
	if username == "" && strings.HasPrefix(input, "@") {
		username = strings.TrimPrefix(input, "@")
	}
	if username != "" {
		id, err := c.findChannelIDByHandle(ctx, username)
		if err != nil {
			return "", err
		}
		if id != "" {
			return id, nil
		}
		return c.searchChannelID(ctx, username)
	}

	if match := customNamePattern.FindStringSubmatch(input); match != nil {
		return c.searchChannelID(ctx, match[1])
	}
	return input, nil
}

func (c *Client) findChannelIDByHandle(ctx context.Context, handle string) (string, error) {
	if !strings.HasPrefix(handle, "@") {
		handle = "@" + handle
	}
	data, err := getJSON[youtube.ChannelIDList](ctx, c.http, "channels", map[string]string{
		"part":      "id",
		"forHandle": handle,
	})
	if err != nil {
		return "", err
	}
	if len(data.Items) == 0 {
		return "", nil
	}
	return data.Items[0].ID, nil
}

func (c *Client) searchChannelID(ctx context.Context, query string) (string, error) {
	data, err := getJSON[youtube.SearchList](ctx, c.http, "search", map[string]string{
		"part":       "snippet",
		"q":          query,
		"type":       "channel",
		"maxResults": "1",
	})
	if err != nil {
		return "", err
	}
	if len(data.Items) == 0 || data.Items[0].Snippet.ChannelID == "" {
		return "", notFound("Channel", query)
	}
	return data.Items[0].Snippet.ChannelID, nil
}

func mapChannel(item youtube.Channel) Channel {
	subs := parseCount(item.Statistics.SubscriberCount)
	views := parseCount(item.Statistics.ViewCount)
	username := strings.TrimSpace(item.Snippet.CustomURL)
	switch {
	case username == "":
		username = "@" + strings.ToLower(strings.ReplaceAll(item.Snippet.Title, " ", ""))
	case !strings.HasPrefix(username, "@"):
		username = "@" + username
	}
	return Channel{
		ID:                item.ID,
		Name:              item.Snippet.Title,
		Username:          username,
		Subscribers:       subs,
		SubscribersFmt:    FormatNumber(subs),
		TotalViews:        views,
		TotalViewsFmt:     FormatNumber(views),
		VideoCount:        parseCount(item.Statistics.VideoCount),
		Country:           item.Snippet.Country,
		Thumbnails:        mapThumbnails(item.Snippet.Thumbnails),
		UploadsPlaylistID: item.ContentDetails.RelatedPlaylists.Uploads,
	}
}

func mapThumbnails(in youtube.Thumbnails) Thumbnails {
	out := Thumbnails{
		Default: mapThumbnail(in.Default),
		Medium:  mapThumbnail(in.Medium),
		High:    mapThumbnail(in.High),
	}
	if in.Standard != nil {
		thumb := mapThumbnail(in.Standard)
		out.Standard = &thumb
	}
	if in.Maxres != nil {
		thumb := mapThumbnail(in.Maxres)
		out.Maxres = &thumb
	}
	return out
}

func mapThumbnail(in *youtube.Thumbnail) Thumbnail {
	if in == nil {
		return Thumbnail{}
	}
	return Thumbnail{URL: in.URL, Width: in.Width, Height: in.Height}
}

func recentThumbnail(thumbs youtube.Thumbnails) string {
	if thumbs.High != nil && thumbs.High.URL != "" {
		return thumbs.High.URL
	}
	if thumbs.Default != nil {
		return thumbs.Default.URL
	}
	return ""
}
