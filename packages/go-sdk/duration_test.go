package lyra

import "testing"

func TestParseDuration(t *testing.T) {
	tests := []struct {
		in   string
		want int
	}{
		{in: "PT1H23M45S", want: 5025},
		{in: "PT10M30S", want: 630},
		{in: "PT45S", want: 45},
		{in: "PT2H", want: 7200},
		{in: "P1DT2H", want: 93600},
		{in: "", want: 0},
		{in: "not-a-duration", want: 0},
	}
	for _, tt := range tests {
		if got := ParseDuration(tt.in); got != tt.want {
			t.Errorf("ParseDuration(%q) = %d, want %d", tt.in, got, tt.want)
		}
	}
}

func TestFormatDurationClock(t *testing.T) {
	tests := []struct {
		in   int
		want string
	}{
		{in: 90, want: "1:30"},
		{in: 3661, want: "1:01:01"},
		{in: 5, want: "0:05"},
	}
	for _, tt := range tests {
		if got := FormatDurationClock(tt.in); got != tt.want {
			t.Errorf("FormatDurationClock(%d) = %q, want %q", tt.in, got, tt.want)
		}
	}
}
