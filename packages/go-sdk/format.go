package lyra

import (
	"math"
	"strconv"
	"time"

	"golang.org/x/text/language"
	"golang.org/x/text/message"
	"golang.org/x/text/number"
)

var english = message.NewPrinter(language.English)

// FormatNumber renders n in en-US compact notation, such as 1500000 → "1.5M".
// x/text has no compact formatter yet, so the scale suffix is applied here and
// the coefficient is printed with en-US decimal rules.
func FormatNumber(n int64) string {
	negative := n < 0
	var magnitude uint64
	if negative {
		// Negating MinInt64 overflows, so build the magnitude in uint64.
		magnitude = uint64(-(n + 1)) + 1
	} else {
		magnitude = uint64(n)
	}
	formatted := formatMagnitude(magnitude)
	if negative {
		return "-" + formatted
	}
	return formatted
}

func formatMagnitude(n uint64) string {
	switch {
	case n >= 1_000_000_000_000:
		return compactScaled(n, 1_000_000_000_000, "T")
	case n >= 1_000_000_000:
		return compactScaled(n, 1_000_000_000, "B")
	case n >= 1_000_000:
		return compactScaled(n, 1_000_000, "M")
	case n >= 1_000:
		return compactScaled(n, 1_000, "K")
	default:
		return english.Sprint(number.Decimal(n, number.MaxFractionDigits(0)))
	}
}

func compactScaled(n, div uint64, suffix string) string {
	scaled := math.Round((float64(n)/float64(div))*10) / 10
	if scaled >= 1000 {
		switch suffix {
		case "K":
			return formatMagnitude(1_000_000)
		case "M":
			return formatMagnitude(1_000_000_000)
		case "B":
			return formatMagnitude(1_000_000_000_000)
		}
	}
	return formatCoefficient(scaled) + suffix
}

func formatCoefficient(scaled float64) string {
	if scaled == math.Trunc(scaled) {
		return english.Sprint(number.Decimal(int64(scaled), number.MaxFractionDigits(0)))
	}
	return english.Sprint(number.Decimal(scaled, number.MinFractionDigits(1), number.MaxFractionDigits(1)))
}

// FormatDate renders an RFC3339 timestamp as an en-US long date in UTC.
func FormatDate(iso string) string {
	parsed, err := time.Parse(time.RFC3339, iso)
	if err != nil {
		parsed, err = time.Parse(time.RFC3339Nano, iso)
	}
	if err != nil {
		return "Invalid Date"
	}
	return parsed.UTC().Format("January 2, 2006")
}

// RelativeTime labels how long ago t was: "3 days ago", "2 hours ago", "1 minute ago".
func RelativeTime(t time.Time) string {
	diff := time.Since(t)
	if diff < 0 {
		diff = -diff
	}
	days := int(diff / (24 * time.Hour))
	hours := int(diff / time.Hour)
	minutes := int(diff / time.Minute)
	if days >= 1 {
		return plural(days, "day")
	}
	if hours >= 1 {
		return plural(hours, "hour")
	}
	return plural(minutes, "minute")
}

func plural(n int, unit string) string {
	label := unit
	switch unit {
	case "minute":
		if n != 1 {
			label += "s"
		}
	default:
		if n > 1 {
			label += "s"
		}
	}
	return strconv.Itoa(n) + " " + label + " ago"
}

func atoi(s string) int {
	if s == "" {
		return 0
	}
	n, err := strconv.Atoi(s)
	if err != nil {
		return 0
	}
	return n
}

func parseCount(s string) int64 {
	if s == "" {
		return 0
	}
	n, err := strconv.ParseInt(s, 10, 64)
	if err != nil {
		return 0
	}
	return n
}
