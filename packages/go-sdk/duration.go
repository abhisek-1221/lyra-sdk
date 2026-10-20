package lyra

import (
	"regexp"
	"strings"
)

var isoDuration = regexp.MustCompile(`P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?`)

// ParseDuration converts a YouTube ISO-8601 duration such as "PT1H23M45S" or "P1DT2H" into seconds.
// Unrecognized input returns 0.
func ParseDuration(iso string) int {
	match := isoDuration.FindStringSubmatch(iso)
	if match == nil {
		return 0
	}
	return atoi(match[1])*86400 + atoi(match[2])*3600 + atoi(match[3])*60 + atoi(match[4])
}

// FormatDuration renders a total as "2d 5h 32m" and omits zero parts.
// Zero seconds is "0s".
func FormatDuration(totalSeconds int) string {
	if totalSeconds < 0 {
		totalSeconds = 0
	}
	days := totalSeconds / 86400
	hours := (totalSeconds % 86400) / 3600
	minutes := (totalSeconds % 3600) / 60
	seconds := totalSeconds % 60

	var parts []string
	if days > 0 {
		parts = append(parts, itoa(days)+"d")
	}
	if hours > 0 {
		parts = append(parts, itoa(hours)+"h")
	}
	if minutes > 0 {
		parts = append(parts, itoa(minutes)+"m")
	}
	if seconds > 0 || len(parts) == 0 {
		parts = append(parts, itoa(seconds)+"s")
	}
	return strings.Join(parts, " ")
}

// FormatDurationClock renders seconds as "3:45" or "1:23:45".
func FormatDurationClock(totalSeconds int) string {
	if totalSeconds < 0 {
		totalSeconds = 0
	}
	hours := totalSeconds / 3600
	minutes := (totalSeconds % 3600) / 60
	seconds := totalSeconds % 60
	if hours > 0 {
		return itoa(hours) + ":" + pad2(minutes) + ":" + pad2(seconds)
	}
	return itoa(minutes) + ":" + pad2(seconds)
}

func pad2(n int) string {
	if n < 10 {
		return "0" + itoa(n)
	}
	return itoa(n)
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	var buf [20]byte
	i := len(buf)
	for n > 0 {
		i--
		buf[i] = byte('0' + n%10)
		n /= 10
	}
	return string(buf[i:])
}
