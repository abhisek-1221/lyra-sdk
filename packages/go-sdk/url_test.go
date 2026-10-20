package lyra

import "testing"

func TestExtractIDs(t *testing.T) {
	tests := []struct {
		name string
		fn   func(string) string
		in   string
		want string
	}{
		{name: "watch", fn: ExtractVideoID, in: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", want: "dQw4w9WgXcQ"},
		{name: "short", fn: ExtractVideoID, in: "https://youtu.be/dQw4w9WgXcQ", want: "dQw4w9WgXcQ"},
		{name: "shorts", fn: ExtractVideoID, in: "https://www.youtube.com/shorts/abcdefghijk", want: "abcdefghijk"},
		{name: "embed", fn: ExtractVideoID, in: "https://www.youtube.com/embed/abcdefghijk", want: "abcdefghijk"},
		{name: "no video", fn: ExtractVideoID, in: "https://example.com", want: ""},
		{name: "channel", fn: ExtractChannelID, in: "https://www.youtube.com/channel/UC1234567890123456789012", want: "UC1234567890123456789012"},
		{name: "channel query", fn: ExtractChannelID, in: "https://www.youtube.com/channel/UC1234567890123456789012?si=abc", want: "UC1234567890123456789012"},
		{name: "channel fragment", fn: ExtractChannelID, in: "https://www.youtube.com/channel/UC1234567890123456789012#about", want: "UC1234567890123456789012"},
		{name: "handle", fn: ExtractUsername, in: "https://www.youtube.com/@MrBeast", want: "MrBeast"},
		{name: "handle query", fn: ExtractUsername, in: "https://www.youtube.com/@MrBeast?si=abc", want: "MrBeast"},
		{name: "handle fragment", fn: ExtractUsername, in: "https://www.youtube.com/@MrBeast#videos", want: "MrBeast"},
		{name: "no handle", fn: ExtractUsername, in: "https://www.youtube.com/watch?v=abc", want: ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.fn(tt.in); got != tt.want {
				t.Fatalf("got %q want %q", got, tt.want)
			}
		})
	}
}
