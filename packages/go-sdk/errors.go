package lyra

import (
	"fmt"
	"strconv"
)

// Kind classifies a YouTube API failure.
type Kind int

const (
	// KindAPI is any failure that is not auth, quota, forbidden or not-found:
	// 5xx responses, unexpected statuses, and transport or read failures.
	KindAPI Kind = iota
	// KindNotFound means the requested resource does not exist (HTTP 404 or a
	// YouTube reason ending in "NotFound").
	KindNotFound
	// KindQuota means the quota or a rate limit is exhausted (reasons
	// quotaExceeded, dailyLimitExceeded, rateLimitExceeded,
	// userRateLimitExceeded, or HTTP 429).
	KindQuota
	// KindAuth means the API key is missing, invalid or expired (reasons
	// keyInvalid, keyExpired, API_KEY_INVALID, API_KEY_EXPIRED, or HTTP 401).
	KindAuth
	// KindForbidden is a 403 that is not quota or auth, such as a video with
	// comments disabled, a private resource, or insufficient permissions.
	KindForbidden
)

// String returns the constant's name, for example "KindQuota".
func (k Kind) String() string {
	switch k {
	case KindAPI:
		return "KindAPI"
	case KindNotFound:
		return "KindNotFound"
	case KindQuota:
		return "KindQuota"
	case KindAuth:
		return "KindAuth"
	case KindForbidden:
		return "KindForbidden"
	default:
		return "Kind(" + strconv.Itoa(int(k)) + ")"
	}
}

var (
	// ErrNotFound is returned when a video, channel or other resource does not exist.
	ErrNotFound = &Error{Kind: KindNotFound}
	// ErrQuota is returned when the YouTube Data API quota or a rate limit is exhausted.
	ErrQuota = &Error{Kind: KindQuota}
	// ErrAuth is returned when the API key is missing, invalid or expired.
	ErrAuth = &Error{Kind: KindAuth}
	// ErrForbidden is returned when YouTube refuses a request for a reason other
	// than quota or auth, such as comments being disabled on a video.
	ErrForbidden = &Error{Kind: KindForbidden}
)

// Error is a YouTube API failure. Use errors.Is with ErrNotFound, ErrQuota,
// ErrAuth or ErrForbidden, or errors.As to inspect its fields.
type Error struct {
	Kind Kind
	// Status is the HTTP status of the failed response, or 0 for a transport failure.
	Status int
	// Reason is YouTube's machine-readable reason, such as "commentsDisabled",
	// or empty when the response carried none.
	Reason   string
	Message  string
	Resource string
	ID       string
	cause    error
}

func (e *Error) Error() string {
	if e == nil {
		return ""
	}
	if e.Message != "" {
		return e.Message
	}
	return defaultMessage(e.Kind, e.Status, e.Resource, e.ID)
}

// Unwrap returns the transport or read error preserved after retries are exhausted.
func (e *Error) Unwrap() error {
	if e == nil {
		return nil
	}
	return e.cause
}

// Is reports whether target is a sentinel with the same Kind.
func (e *Error) Is(target error) bool {
	other, ok := target.(*Error)
	if !ok || other == nil || e == nil {
		return false
	}
	return e.Kind == other.Kind && other.Kind != KindAPI
}

func defaultMessage(kind Kind, status int, resource, id string) string {
	switch kind {
	case KindNotFound:
		return fmt.Sprintf("%s not found: %s", resource, id)
	case KindQuota:
		return "YouTube API quota exceeded. Try again later."
	case KindAuth:
		return "Invalid or missing YouTube API key."
	case KindForbidden:
		return "YouTube API request forbidden."
	default:
		if status != 0 {
			return fmt.Sprintf("YouTube API error (%d)", status)
		}
		return "YouTube API error"
	}
}

func notFound(resource, id string) *Error {
	return &Error{
		Kind:     KindNotFound,
		Status:   404,
		Resource: resource,
		ID:       id,
		Message:  defaultMessage(KindNotFound, 404, resource, id),
	}
}
