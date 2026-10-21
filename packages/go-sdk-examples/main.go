package main

import (
	"bufio"
	"context"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/abhisek-1221/lyra-sdk/packages/go-sdk"
)

func main() {
	apiKey := loadAPIKey()
	if apiKey == "" {
		fmt.Fprintln(os.Stderr, "YOUTUBE_API_KEY is not set.")
		fmt.Fprintln(os.Stderr, "Export it, or add it to .env or the repo root .env.")
		os.Exit(1)
	}

	client, err := lyra.New(apiKey)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	if err := run(ctx, client); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run(ctx context.Context, client *lyra.Client) error {
	const videoID = "dQw4w9WgXcQ"
	const secondID = "jNQXAC9IVRw"

	fmt.Println("=== Video ===")
	video, err := client.Video(ctx, videoID)
	if err != nil {
		return err
	}
	fmt.Printf("Title: %s\n", video.Title)
	fmt.Printf("Channel: %s\n", video.Channel)
	fmt.Printf("Views: %d (%s)\n", video.Views, video.ViewsFmt)
	fmt.Printf("Likes: %d (%s)\n", video.Likes, video.LikesFmt)
	fmt.Printf("Duration: %d seconds (%s)\n", video.Duration, video.DurationFmt)
	fmt.Printf("Published: %s\n", video.Published)

	fmt.Println("\n=== Video title ===")
	title, err := client.VideoTitle(ctx, videoID)
	if err != nil {
		return err
	}
	fmt.Printf("Title: %s\n", title)

	fmt.Println("\n=== Videos ===")
	videos, err := client.Videos(ctx, []string{videoID, secondID})
	if err != nil {
		return err
	}
	for _, item := range videos {
		fmt.Printf("- %s (%s)\n", item.Title, item.Channel)
	}

	fmt.Println("\n=== Channel ===")
	channel, err := client.Channel(ctx, "@MrBeast")
	if err != nil {
		return err
	}
	fmt.Printf("Name: %s\n", channel.Name)
	fmt.Printf("Subscribers: %d (%s)\n", channel.Subscribers, channel.SubscribersFmt)
	fmt.Printf("Video count: %d\n", channel.VideoCount)

	fmt.Println("\n=== Recent uploads ===")
	recent, err := client.ChannelVideos(ctx, "@MrBeast", 3)
	if err != nil {
		return err
	}
	for _, item := range recent {
		fmt.Printf("- %s (%s) %s\n", item.Title, item.DurationFmt, item.UploadAge)
	}

	const playlistID = "PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf"

	fmt.Println("\n=== Playlist info ===")
	info, err := client.PlaylistInfo(ctx, playlistID)
	if err != nil {
		return err
	}
	fmt.Printf("Title: %s\n", info.Title)
	fmt.Printf("Description: %s\n", info.Description)

	fmt.Println("\n=== Playlist video ids ===")
	ids, err := client.PlaylistVideoIDs(ctx, playlistID)
	if err != nil {
		return err
	}
	fmt.Printf("Count: %d\n", len(ids))
	limit := 3
	if len(ids) < limit {
		limit = len(ids)
	}
	fmt.Printf("First ids: %s\n", strings.Join(ids[:limit], ", "))

	fmt.Println("\n=== Playlist ===")
	playlist, err := client.Playlist(ctx, playlistID)
	if err != nil {
		return err
	}
	fmt.Printf("Video count: %d\n", playlist.VideoCount)
	fmt.Printf("Total duration: %s\n", playlist.TotalDurationFmt)
	for _, item := range playlist.Videos {
		fmt.Printf("- %s (%s)\n", item.Title, item.DurationFmt)
	}

	fmt.Println("\n=== Playlist query ===")
	query, err := client.PlaylistQuery(playlistID).
		FilterByViews(1000, 0).
		SortBy("views", "desc").
		Between(1, 3).
		Execute(ctx)
	if err != nil {
		return err
	}
	for _, item := range query.Videos {
		fmt.Printf("- %s (%s views)\n", item.Title, item.ViewsFmt)
	}

	fmt.Println("\n=== Top comments ===")
	top, err := client.TopComments(ctx, videoID, 3)
	if err != nil {
		return err
	}
	for _, thread := range top {
		comment := thread.TopLevelComment
		fmt.Printf("- %s: %s (%d likes, %d replies)\n", comment.AuthorName, comment.Text, comment.LikeCount, thread.TotalReplyCount)
	}

	for _, thread := range top {
		if thread.TotalReplyCount == 0 || thread.TotalReplyCount > 10 {
			continue
		}
		fmt.Println("\n=== Comment replies ===")
		replies, err := client.CommentReplies(ctx, thread.TopLevelComment.ID, "plainText")
		if err != nil {
			return err
		}
		shown := replies
		if len(shown) > 2 {
			shown = shown[:2]
		}
		for _, reply := range shown {
			fmt.Printf("- %s: %s\n", reply.AuthorName, reply.Text)
		}
		break
	}
	if len(top) > 0 {
		skipped := true
		for _, thread := range top {
			if thread.TotalReplyCount > 0 && thread.TotalReplyCount <= 10 {
				skipped = false
				break
			}
		}
		if skipped {
			fmt.Println("\n=== Comment replies ===")
			fmt.Printf("Skipped. The first threads have %d replies, and fetching every page would spend a large quota.\n", top[0].TotalReplyCount)
		}
	}

	fmt.Println("\n=== Comment query ===")
	comments, err := client.CommentQuery(videoID).
		Search("never").
		Limit(3).
		Execute(ctx)
	if err != nil {
		return err
	}
	fmt.Printf("Results: %d\n", comments.TotalResults)
	for _, thread := range comments.Threads {
		comment := thread.TopLevelComment
		fmt.Printf("- %s: %s (%d likes)\n", comment.AuthorName, comment.Text, comment.LikeCount)
	}
	return nil
}

func loadAPIKey() string {
	if key := strings.TrimSpace(os.Getenv("YOUTUBE_API_KEY")); key != "" {
		return key
	}
	for _, path := range []string{".env", "../../.env"} {
		if key := readEnvKey(path, "YOUTUBE_API_KEY"); key != "" {
			return key
		}
	}
	return ""
}

func readEnvKey(path, name string) string {
	file, err := os.Open(path)
	if err != nil {
		return ""
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, ok := strings.Cut(line, "=")
		if !ok || strings.TrimSpace(key) != name {
			continue
		}
		value = strings.TrimSpace(value)
		value = strings.Trim(value, `"'`)
		return value
	}
	return ""
}
