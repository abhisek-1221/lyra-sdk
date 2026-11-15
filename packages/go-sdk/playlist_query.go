package lyra

import (
	"context"
	"fmt"
	"slices"
)

// SortField is a playlist video attribute that PlaylistQuery.SortBy orders by.
type SortField string

// Sort fields accepted by PlaylistQuery.SortBy.
const (
	SortByDuration SortField = "duration"
	SortByViews    SortField = "views"
	SortByLikes    SortField = "likes"
)

// SortOrder is the direction PlaylistQuery.SortBy orders in.
type SortOrder string

// Sort orders accepted by PlaylistQuery.SortBy. Any value other than Asc sorts descending.
const (
	Asc  SortOrder = "asc"
	Desc SortOrder = "desc"
)

// PlaylistQuery starts a filter, sort, and slice over one playlist.
// The id may be a playlist URL or a bare id.
func (c *Client) PlaylistQuery(urlOrID string) *PlaylistQuery {
	return &PlaylistQuery{client: c, playlistID: resolvePlaylistID(urlOrID)}
}

// PlaylistQuery filters, sorts, and slices the videos in one playlist.
type PlaylistQuery struct {
	client     *Client
	playlistID string

	durationMin, durationMax *int
	viewsMin, viewsMax       *int64
	likesMin, likesMax       *int64

	sortField SortField
	sortDesc  bool
	hasSort   bool

	rangeStart, rangeEnd int
	hasRange             bool
}

// FilterByDuration keeps videos whose length in seconds falls in [min, max].
// A zero bound is unset.
func (q *PlaylistQuery) FilterByDuration(min, max int) *PlaylistQuery {
	q.durationMin = nil
	q.durationMax = nil
	if min != 0 {
		q.durationMin = &min
	}
	if max != 0 {
		q.durationMax = &max
	}
	return q
}

// FilterByViews keeps videos whose view count falls in [min, max].
// A zero bound is unset.
func (q *PlaylistQuery) FilterByViews(min, max int64) *PlaylistQuery {
	q.viewsMin = nil
	q.viewsMax = nil
	if min != 0 {
		q.viewsMin = &min
	}
	if max != 0 {
		q.viewsMax = &max
	}
	return q
}

// FilterByLikes keeps videos whose like count falls in [min, max].
// A zero bound is unset.
func (q *PlaylistQuery) FilterByLikes(min, max int64) *PlaylistQuery {
	q.likesMin = nil
	q.likesMax = nil
	if min != 0 {
		q.likesMin = &min
	}
	if max != 0 {
		q.likesMax = &max
	}
	return q
}

// SortBy orders videos by field in the given order.
// An unknown field makes Execute return an error before any request is sent.
func (q *PlaylistQuery) SortBy(field SortField, order SortOrder) *PlaylistQuery {
	q.sortField = field
	q.sortDesc = order != Asc
	q.hasSort = true
	return q
}

// Between keeps a 1-indexed inclusive slice after filtering and sorting.
func (q *PlaylistQuery) Between(start, end int) *PlaylistQuery {
	q.rangeStart = start
	q.rangeEnd = end
	q.hasRange = true
	return q
}

// Execute loads the playlist and applies the query.
func (q *PlaylistQuery) Execute(ctx context.Context) (PlaylistQueryResult, error) {
	if q.hasSort {
		switch q.sortField {
		case SortByDuration, SortByViews, SortByLikes:
		default:
			return PlaylistQueryResult{}, fmt.Errorf("lyra-sdk: unknown playlist sort field %q", q.sortField)
		}
	}
	loaded, err := q.client.loadPlaylist(ctx, q.playlistID)
	if err != nil {
		return PlaylistQueryResult{}, err
	}
	info := loaded.info
	videos := q.applyFilters(loaded.videos)
	videos = q.applySort(videos)
	videos = q.applyRange(videos)
	total := totalDuration(videos)
	return PlaylistQueryResult{
		ID:               info.ID,
		Title:            info.Title,
		Description:      info.Description,
		Thumbnails:       info.Thumbnails,
		Videos:           videos,
		VideoCount:       len(videos),
		OriginalCount:    len(loaded.ids),
		TotalDuration:    total,
		TotalDurationFmt: FormatDuration(total),
	}, nil
}

func (q *PlaylistQuery) applyFilters(videos []PlaylistVideo) []PlaylistVideo {
	out := make([]PlaylistVideo, 0, len(videos))
	for _, video := range videos {
		if q.durationMin != nil && video.Duration < *q.durationMin {
			continue
		}
		if q.durationMax != nil && video.Duration > *q.durationMax {
			continue
		}
		if q.viewsMin != nil && video.Views < *q.viewsMin {
			continue
		}
		if q.viewsMax != nil && video.Views > *q.viewsMax {
			continue
		}
		if q.likesMin != nil && video.Likes < *q.likesMin {
			continue
		}
		if q.likesMax != nil && video.Likes > *q.likesMax {
			continue
		}
		out = append(out, video)
	}
	return out
}

func (q *PlaylistQuery) applySort(videos []PlaylistVideo) []PlaylistVideo {
	if !q.hasSort {
		return videos
	}
	sorted := slices.Clone(videos)
	slices.SortStableFunc(sorted, func(a, b PlaylistVideo) int {
		left, right := sortValue(a, q.sortField), sortValue(b, q.sortField)
		switch {
		case left < right:
			if q.sortDesc {
				return 1
			}
			return -1
		case left > right:
			if q.sortDesc {
				return -1
			}
			return 1
		default:
			return 0
		}
	})
	return sorted
}

func sortValue(video PlaylistVideo, field SortField) int64 {
	switch field {
	case SortByDuration:
		return int64(video.Duration)
	case SortByLikes:
		return video.Likes
	default:
		return video.Views
	}
}

func (q *PlaylistQuery) applyRange(videos []PlaylistVideo) []PlaylistVideo {
	if !q.hasRange {
		return videos
	}
	start := q.rangeStart
	if start < 1 {
		start = 1
	}
	end := q.rangeEnd
	if end > len(videos) {
		end = len(videos)
	}
	if start > end || start > len(videos) {
		return []PlaylistVideo{}
	}
	return videos[start-1 : end]
}
