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

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
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
