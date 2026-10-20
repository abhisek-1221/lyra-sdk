package youtube

// Thumbnail is a YouTube image resource.
type Thumbnail struct {
	URL    string `json:"url"`
	Width  int    `json:"width"`
	Height int    `json:"height"`
}

// Thumbnails is the image set returned on snippet resources.
type Thumbnails struct {
	Default  *Thumbnail `json:"default"`
	Medium   *Thumbnail `json:"medium"`
	High     *Thumbnail `json:"high"`
	Standard *Thumbnail `json:"standard"`
	Maxres   *Thumbnail `json:"maxres"`
}

// Video is a videos.list item.
type Video struct {
	ID      string `json:"id"`
	Snippet struct {
		Title        string     `json:"title"`
		Description  string     `json:"description"`
		ChannelID    string     `json:"channelId"`
		ChannelTitle string     `json:"channelTitle"`
		PublishedAt  string     `json:"publishedAt"`
		Thumbnails   Thumbnails `json:"thumbnails"`
	} `json:"snippet"`
	Statistics struct {
		ViewCount    string `json:"viewCount"`
		LikeCount    string `json:"likeCount"`
		CommentCount string `json:"commentCount"`
	} `json:"statistics"`
	ContentDetails struct {
		Duration string `json:"duration"`
	} `json:"contentDetails"`
}

// VideoList is a videos.list response.
type VideoList struct {
	Items []Video `json:"items"`
}

// Channel is a channels.list item.
type Channel struct {
	ID      string `json:"id"`
	Snippet struct {
		Title      string     `json:"title"`
		CustomURL  string     `json:"customUrl"`
		Country    string     `json:"country"`
		Thumbnails Thumbnails `json:"thumbnails"`
	} `json:"snippet"`
	Statistics struct {
		SubscriberCount string `json:"subscriberCount"`
		ViewCount       string `json:"viewCount"`
		VideoCount      string `json:"videoCount"`
	} `json:"statistics"`
	ContentDetails struct {
		RelatedPlaylists struct {
			Uploads string `json:"uploads"`
		} `json:"relatedPlaylists"`
	} `json:"contentDetails"`
}

// ChannelList is a channels.list response.
type ChannelList struct {
	Items []Channel `json:"items"`
}

// ChannelIDList is a channels.list response that only requested the id part.
type ChannelIDList struct {
	Items []struct {
		ID string `json:"id"`
	} `json:"items"`
}

// Playlist is a playlists.list item.
type Playlist struct {
	ID      string `json:"id"`
	Snippet struct {
		Title       string     `json:"title"`
		Description string     `json:"description"`
		Thumbnails  Thumbnails `json:"thumbnails"`
	} `json:"snippet"`
}

// PlaylistList is a playlists.list response.
type PlaylistList struct {
	Items []Playlist `json:"items"`
}

// PlaylistItemPage is one page of playlistItems.list contentDetails.
type PlaylistItemPage struct {
	Items []struct {
		ContentDetails struct {
			VideoID string `json:"videoId"`
		} `json:"contentDetails"`
	} `json:"items"`
	NextPageToken string `json:"nextPageToken"`
}

// PlaylistItem is a playlistItems.list snippet.
type PlaylistItem struct {
	Snippet struct {
		Title       string `json:"title"`
		PublishedAt string `json:"publishedAt"`
		ResourceID  struct {
			VideoID string `json:"videoId"`
		} `json:"resourceId"`
		Thumbnails Thumbnails `json:"thumbnails"`
	} `json:"snippet"`
}

// PlaylistItemList is a playlistItems.list response.
type PlaylistItemList struct {
	Items []PlaylistItem `json:"items"`
}

// SearchList is a search.list response used to resolve a channel name.
type SearchList struct {
	Items []struct {
		Snippet struct {
			ChannelID string `json:"channelId"`
		} `json:"snippet"`
	} `json:"items"`
}
