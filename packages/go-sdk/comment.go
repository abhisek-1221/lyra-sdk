package lyra

import (
	"context"
	"math"

	"golang.org/x/sync/errgroup"

	"github.com/abhisek-1221/lyra-sdk/packages/go-sdk/internal/youtube"
)

const (
	commentPageSize       = 100
	replyFetchConcurrency = 5
)

// Comments lists comment threads for a video. Pages stay sequential.
func (c *Client) Comments(ctx context.Context, videoURLOrID string, opts CommentOptions) ([]CommentThread, error) {
	return c.commentThreads(ctx, resolveVideoID(videoURLOrID), "", opts)
}

// CommentReplies lists every reply to a comment. Pages stay sequential.
func (c *Client) CommentReplies(ctx context.Context, parentID, textFormat string) ([]Comment, error) {
	format := normalizeTextFormat(textFormat)
	var comments []Comment
	pageToken := ""
	for {
		params := map[string]string{
			"part":       "snippet",
			"parentId":   parentID,
			"maxResults": itoa(commentPageSize),
			"textFormat": format,
		}
		if pageToken != "" {
			params["pageToken"] = pageToken
		}
		page, err := getJSON[youtube.CommentList](ctx, c.http, "comments", params)
		if err != nil {
			return nil, err
		}
		if len(page.Items) == 0 {
			break
		}
		for _, item := range page.Items {
			comments = append(comments, mapComment(item, format))
		}
		if page.NextPageToken == "" {
			break
		}
		pageToken = page.NextPageToken
	}
	if comments == nil {
		comments = []Comment{}
	}
	return comments, nil
}

// CommentsWithReplies lists threads and fills replies that the thread page omitted.
func (c *Client) CommentsWithReplies(ctx context.Context, videoURLOrID string, opts CommentOptions) ([]CommentThread, error) {
	threads, err := c.Comments(ctx, videoURLOrID, opts)
	if err != nil {
		return nil, err
	}
	return c.hydrateMissingReplies(ctx, threads, normalizeTextFormat(opts.TextFormat))
}

// TopComments returns the most relevant threads. limit defaults to 20 and is capped at 100.
func (c *Client) TopComments(ctx context.Context, videoURLOrID string, limit int) ([]CommentThread, error) {
	if limit <= 0 {
		limit = 20
	}
	if limit > commentPageSize {
		limit = commentPageSize
	}
	threads, err := c.Comments(ctx, videoURLOrID, CommentOptions{
		Order:      "relevance",
		MaxResults: limit,
	})
	if err != nil {
		return nil, err
	}
	if len(threads) > limit {
		threads = threads[:limit]
	}
	return threads, nil
}

// SearchComments lists threads matching query.
func (c *Client) SearchComments(ctx context.Context, videoURLOrID, query string, opts CommentOptions) ([]CommentThread, error) {
	opts.SearchTerms = query
	if opts.TextFormat == "" {
		opts.TextFormat = "plainText"
	}
	return c.Comments(ctx, videoURLOrID, opts)
}

// ChannelComments lists comment threads related to a channel.
func (c *Client) ChannelComments(ctx context.Context, channelID string, opts CommentOptions) ([]CommentThread, error) {
	return c.commentThreads(ctx, "", channelID, opts)
}

// CommentStats summarizes threads the same way the TypeScript client does.
func (c *Client) CommentStats(videoID string, threads []CommentThread) CommentStats {
	return commentStats(videoID, threads)
}

// FlattenComments returns top-level comments followed by their loaded replies.
func (c *Client) FlattenComments(threads []CommentThread) []Comment {
	flat := make([]Comment, 0)
	for _, thread := range threads {
		flat = append(flat, thread.TopLevelComment)
		flat = append(flat, thread.Replies...)
	}
	return flat
}

func (c *Client) commentThreads(ctx context.Context, videoID, channelID string, opts CommentOptions) ([]CommentThread, error) {
	if opts.MaxResults < 0 {
		return []CommentThread{}, nil
	}
	format := normalizeTextFormat(opts.TextFormat)
	maxItems := opts.MaxResults
	threads := make([]CommentThread, 0)
	pageToken := ""
	for {
		remaining := commentPageSize
		if maxItems > 0 {
			remaining = maxItems - len(threads)
			if remaining <= 0 {
				break
			}
			if remaining > commentPageSize {
				remaining = commentPageSize
			}
		}
		params := map[string]string{
			"part":       "snippet,replies",
			"maxResults": itoa(remaining),
			"textFormat": format,
		}
		if videoID != "" {
			params["videoId"] = videoID
		}
		if channelID != "" {
			params["allThreadsRelatedToChannelId"] = channelID
		}
		if opts.Order != "" {
			params["order"] = opts.Order
		}
		if opts.SearchTerms != "" {
			params["searchTerms"] = opts.SearchTerms
		}
		if pageToken != "" {
			params["pageToken"] = pageToken
		}
		page, err := getJSON[youtube.CommentThreadList](ctx, c.http, "commentThreads", params)
		if err != nil {
			return nil, err
		}
		if len(page.Items) == 0 {
			break
		}
		for _, item := range page.Items {
			threads = append(threads, mapThread(item, format))
			if maxItems > 0 && len(threads) >= maxItems {
				break
			}
		}
		if maxItems > 0 && len(threads) >= maxItems {
			break
		}
		if page.NextPageToken == "" {
			break
		}
		pageToken = page.NextPageToken
	}
	return threads, nil
}

func (c *Client) hydrateMissingReplies(ctx context.Context, threads []CommentThread, textFormat string) ([]CommentThread, error) {
	type job struct {
		index int
		id    string
	}
	var jobs []job
	for i, thread := range threads {
		if thread.TotalReplyCount > 0 && len(thread.Replies) < thread.TotalReplyCount {
			jobs = append(jobs, job{index: i, id: thread.TopLevelComment.ID})
		}
	}
	if len(jobs) == 0 {
		return threads, nil
	}
	updated := append([]CommentThread(nil), threads...)
	group, ctx := errgroup.WithContext(ctx)
	group.SetLimit(replyFetchConcurrency)
	for _, item := range jobs {
		group.Go(func() error {
			replies, err := c.CommentReplies(ctx, item.id, textFormat)
			if err != nil {
				return err
			}
			updated[item.index].Replies = replies
			return nil
		})
	}
	if err := group.Wait(); err != nil {
		return nil, err
	}
	return updated, nil
}

func mapComment(item youtube.Comment, textFormat string) Comment {
	text := item.Snippet.TextDisplay
	if textFormat != "html" {
		if item.Snippet.TextOriginal != "" {
			text = item.Snippet.TextOriginal
		}
	}
	return Comment{
		ID:                 item.ID,
		AuthorName:         item.Snippet.AuthorDisplayName,
		AuthorProfileImage: item.Snippet.AuthorProfileImageURL,
		AuthorChannelURL:   item.Snippet.AuthorChannelURL,
		AuthorChannelID:    item.Snippet.AuthorChannelID.Value,
		Text:               text,
		LikeCount:          item.Snippet.LikeCount,
		PublishedAt:        parseTime(item.Snippet.PublishedAt),
		UpdatedAt:          parseTime(item.Snippet.UpdatedAt),
		ParentID:           item.Snippet.ParentID,
	}
}

func mapThread(item youtube.CommentThread, textFormat string) CommentThread {
	replies := make([]Comment, 0, len(item.Replies.Comments))
	for _, reply := range item.Replies.Comments {
		replies = append(replies, mapComment(reply, textFormat))
	}
	return CommentThread{
		ID:              item.ID,
		VideoID:         item.Snippet.VideoID,
		ChannelID:       item.Snippet.ChannelID,
		TopLevelComment: mapComment(item.Snippet.TopLevelComment, textFormat),
		TotalReplyCount: item.Snippet.TotalReplyCount,
		CanReply:        item.Snippet.CanReply,
		IsPublic:        item.Snippet.IsPublic,
		Replies:         replies,
	}
}

func commentStats(videoID string, threads []CommentThread) CommentStats {
	var all []Comment
	totalReplies := 0
	for _, thread := range threads {
		all = append(all, thread.TopLevelComment)
		all = append(all, thread.Replies...)
		loaded := len(thread.Replies)
		totalReplies += loaded
		if extra := thread.TotalReplyCount - loaded; extra > 0 {
			totalReplies += extra
		}
	}
	authors := map[string]struct{}{}
	var totalLikes int64
	var most *Comment
	for i := range all {
		comment := all[i]
		authors[comment.AuthorChannelID] = struct{}{}
		totalLikes += comment.LikeCount
		if most == nil || comment.LikeCount > most.LikeCount {
			copied := comment
			most = &copied
		}
	}
	stats := CommentStats{
		VideoID:          videoID,
		TotalComments:    len(threads),
		TotalReplies:     totalReplies,
		UniqueAuthors:    len(authors),
		MostLikedComment: most,
	}
	if len(all) > 0 {
		stats.AvgLikes = math.Round((float64(totalLikes)/float64(len(all)))*100) / 100
	}
	if len(threads) > 0 {
		stats.ReplyRatio = math.Round((float64(totalReplies)/float64(len(threads)))*100) / 100
	}
	return stats
}

func normalizeTextFormat(format string) string {
	if format == "" {
		return "plainText"
	}
	return format
}
