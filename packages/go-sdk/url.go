package lyra

import "regexp"

var (
	videoIDPattern    = regexp.MustCompile(`(?:v=|/(?:embed|shorts|v)/|youtu\.be/|/e/|watch\?v=|/watch\?.+&v=)([^&?/\s]+)`)
	channelIDPattern  = regexp.MustCompile(`(?:https?://)?(?:www\.)?youtube\.com/channel/([^/?#\s]+)`)
	usernamePattern   = regexp.MustCompile(`(?:https?://)?(?:www\.)?youtube\.com/@([^/?#\s]+)`)
	customNamePattern = regexp.MustCompile(`(?:youtube\.com/)?(?:c|user)/([^/?#\s]+)`)
	bareChannelID     = regexp.MustCompile(`^UC[\w-]{22}$`)
	playlistIDPattern = regexp.MustCompile(`[?&]list=([a-zA-Z0-9_-]+)`)
)

// ExtractVideoID returns a video id from a YouTube URL, or "" when none is present.
func ExtractVideoID(raw string) string {
	match := videoIDPattern.FindStringSubmatch(raw)
	if match == nil {
		return ""
	}
	return match[1]
}

// ExtractChannelID returns a channel id from a /channel/UC… URL, or "".
func ExtractChannelID(raw string) string {
	match := channelIDPattern.FindStringSubmatch(raw)
	if match == nil {
		return ""
	}
	return match[1]
}

// ExtractUsername returns the handle from a /@name URL without the leading @, or "".
func ExtractUsername(raw string) string {
	match := usernamePattern.FindStringSubmatch(raw)
	if match == nil {
		return ""
	}
	return match[1]
}

// ExtractPlaylistID returns the list id from a playlist URL, or "".
func ExtractPlaylistID(raw string) string {
	match := playlistIDPattern.FindStringSubmatch(raw)
	if match == nil {
		return ""
	}
	return match[1]
}

func resolvePlaylistID(urlOrID string) string {
	if id := ExtractPlaylistID(urlOrID); id != "" {
		return id
	}
	return urlOrID
}

func resolveVideoID(urlOrID string) string {
	if id := ExtractVideoID(urlOrID); id != "" {
		return id
	}
	return urlOrID
}
