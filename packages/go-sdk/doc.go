// Package lyra is the Go data client for YouTube videos and channels.
//
//	c, err := lyra.New(apiKey)
//	video, err := c.Video(ctx, "https://www.youtube.com/watch?v=dQw4w9WgXcQ")
//	channel, err := c.Channel(ctx, "@MrBeast")
//	recent, err := c.ChannelVideos(ctx, channel.ID, 5)
package lyra
