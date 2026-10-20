package lyra

import "time"

// Thumbnail is one YouTube image.
type Thumbnail struct {
	URL    string
	Width  int
	Height int
}

// Thumbnails is the image set on a video or channel.
type Thumbnails struct {
	Default  Thumbnail
	Medium   Thumbnail
	High     Thumbnail
	Standard *Thumbnail
	Maxres   *Thumbnail
}

// Video is the full videos.list record used by Client.Video and Client.Videos.
type Video struct {
	ID          string
	Title       string
	Description string
	Channel     string
	ChannelID   string
	Views       int64
	ViewsFmt    string
	Likes       int64
	LikesFmt    string
	Comments    int64
	CommentsFmt string
	Duration    int
	DurationFmt string
	Published   string
	PublishedAt time.Time
	Thumbnails  Thumbnails
}

// Channel is the channels.list record used by Client.Channel.
type Channel struct {
	ID                string
	Name              string
	Username          string
	Subscribers       int64
	SubscribersFmt    string
	TotalViews        int64
	TotalViewsFmt     string
	VideoCount        int64
	Country           string
	Thumbnails        Thumbnails
	UploadsPlaylistID string
}

// PlaylistInfo is playlist metadata without its videos.
type PlaylistInfo struct {
	ID          string
	Title       string
	Description string
	Thumbnails  Thumbnails
}

// PlaylistVideo is one video inside a playlist.
type PlaylistVideo struct {
	ID           string
	Title        string
	Description  string
	ChannelTitle string
	PublishedAt  time.Time
	Duration     int
	DurationFmt  string
	Views        int64
	ViewsFmt     string
	Likes        int64
	LikesFmt     string
	Thumbnails   Thumbnails
}

// Playlist is a playlist plus every video and the summed duration.
type Playlist struct {
	ID               string
	Title            string
	Description      string
	Thumbnails       Thumbnails
	VideoCount       int
	TotalDuration    int
	TotalDurationFmt string
	Videos           []PlaylistVideo
}

// PlaylistQueryResult is a filtered, sorted, and sliced playlist.
type PlaylistQueryResult struct {
	ID               string
	Title            string
	Description      string
	Thumbnails       Thumbnails
	Videos           []PlaylistVideo
	VideoCount       int
	OriginalCount    int
	TotalDuration    int
	TotalDurationFmt string
}

// Comment is one YouTube comment, either top-level or a reply.
type Comment struct {
	ID                 string
	AuthorName         string
	AuthorProfileImage string
	AuthorChannelURL   string
	AuthorChannelID    string
	Text               string
	LikeCount          int64
	PublishedAt        time.Time
	UpdatedAt          time.Time
	ParentID           string
}

// CommentThread is a top-level comment and the replies included with it.
type CommentThread struct {
	ID              string
	VideoID         string
	ChannelID       string
	TopLevelComment Comment
	TotalReplyCount int
	CanReply        bool
	IsPublic        bool
	Replies         []Comment
}

// CommentStats summarizes a set of comment threads.
type CommentStats struct {
	VideoID          string
	TotalComments    int
	TotalReplies     int
	UniqueAuthors    int
	MostLikedComment *Comment
	AvgLikes         float64
	ReplyRatio       float64
}

// CommentQueryResult is the threads, count, and stats from a comment query.
type CommentQueryResult struct {
	VideoID      string
	Threads      []CommentThread
	TotalResults int
	Stats        CommentStats
}

// CommentOptions controls comment thread listing.
// MaxResults of 0 means no cap. TextFormat defaults to plainText.
type CommentOptions struct {
	Order       string
	MaxResults  int
	SearchTerms string
	TextFormat  string
}

// RecentVideo is one upload returned by Client.ChannelVideos.
type RecentVideo struct {
	ID          string
	Title       string
	Views       int64
	ViewsFmt    string
	Likes       int64
	LikesFmt    string
	Duration    int
	DurationFmt string
	Thumbnail   string
	UploadAge   string
	PublishedAt time.Time
}
