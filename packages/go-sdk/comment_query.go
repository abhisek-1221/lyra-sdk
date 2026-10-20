package lyra

import "context"

// CommentQuery starts a filtered comment listing for one video.
func (c *Client) CommentQuery(videoURLOrID string) *CommentQuery {
	return &CommentQuery{
		client:  c,
		videoID: resolveVideoID(videoURLOrID),
	}
}

// CommentQuery orders, searches, limits, and optionally loads every reply.
type CommentQuery struct {
	client     *Client
	videoID    string
	order      string
	search     string
	limit      int
	textFormat string
	allReplies bool
}

// Order sets "time" or "relevance".
func (q *CommentQuery) Order(order string) *CommentQuery {
	q.order = order
	return q
}

// Search keeps threads matching query.
func (q *CommentQuery) Search(query string) *CommentQuery {
	q.search = query
	return q
}

// Limit caps the number of threads. Zero means no cap.
func (q *CommentQuery) Limit(n int) *CommentQuery {
	q.limit = n
	return q
}

// WithAllReplies fetches replies missing from the thread page.
func (q *CommentQuery) WithAllReplies() *CommentQuery {
	q.allReplies = true
	return q
}

// TextFormat sets "plainText" or "html".
func (q *CommentQuery) TextFormat(format string) *CommentQuery {
	q.textFormat = format
	return q
}

// Execute loads the threads and stats.
func (q *CommentQuery) Execute(ctx context.Context) (CommentQueryResult, error) {
	opts := CommentOptions{
		Order:       q.order,
		MaxResults:  q.limit,
		SearchTerms: q.search,
		TextFormat:  q.textFormat,
	}
	threads, err := q.client.Comments(ctx, q.videoID, opts)
	if err != nil {
		return CommentQueryResult{}, err
	}
	if q.limit > 0 && len(threads) > q.limit {
		threads = threads[:q.limit]
	}
	format := normalizeTextFormat(q.textFormat)
	if q.allReplies {
		threads, err = q.client.hydrateMissingReplies(ctx, threads, format)
		if err != nil {
			return CommentQueryResult{}, err
		}
	}
	return CommentQueryResult{
		VideoID:      q.videoID,
		Threads:      threads,
		TotalResults: len(threads),
		Stats:        commentStats(q.videoID, threads),
	}, nil
}
