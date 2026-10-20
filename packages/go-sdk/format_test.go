package lyra

import (
	"math"
	"testing"
	"time"
)

func TestFormatNumber(t *testing.T) {
	tests := []struct {
		in   int64
		want string
	}{
		{in: 1_500_000, want: "1.5M"},
		{in: 12_300, want: "12.3K"},
		{in: 42, want: "42"},
		{in: 1_000, want: "1K"},
		{in: 999_999, want: "1M"},
		{in: 999_950_000, want: "1B"},
		{in: 999_950_000_000, want: "1T"},
	}
	for _, tt := range tests {
		if got := FormatNumber(tt.in); got != tt.want {
			t.Errorf("FormatNumber(%d) = %q, want %q", tt.in, got, tt.want)
		}
	}
}

func TestFormatNumberMinInt64(t *testing.T) {
	got := FormatNumber(math.MinInt64)
	if got == "" || got[0] != '-' {
		t.Fatalf("FormatNumber(MinInt64) = %q", got)
	}
}

func TestFormatDate(t *testing.T) {
	if got := FormatDate("2024-01-15T12:00:00Z"); got != "January 15, 2024" {
		t.Fatalf("got %q", got)
	}
	if got := FormatDate("nope"); got != "Invalid Date" {
		t.Fatalf("got %q", got)
	}
}

func TestRelativeTime(t *testing.T) {
	now := time.Now()
	if got := RelativeTime(now.Add(-2 * 24 * time.Hour)); got != "2 days ago" {
		t.Fatalf("days = %q", got)
	}
	if got := RelativeTime(now.Add(-3 * time.Hour)); got != "3 hours ago" {
		t.Fatalf("hours = %q", got)
	}
	if got := RelativeTime(now.Add(-24 * time.Hour)); got != "1 day ago" {
		t.Fatalf("day = %q", got)
	}
	if got := RelativeTime(now.Add(-time.Minute)); got != "1 minute ago" {
		t.Fatalf("minute = %q", got)
	}
}
