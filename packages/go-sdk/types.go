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
