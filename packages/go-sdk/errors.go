package lyra

import "fmt"

// Kind classifies a YouTube API failure.
type Kind int

const (
	// KindAPI is a YouTube response that is not auth, quota, or not-found.
	KindAPI Kind = iota
	KindNotFound
	KindQuota
	KindAuth
)

var (
	// ErrNotFound is returned when a video or channel does not exist.
	ErrNotFound = &Error{Kind: KindNotFound}
	// ErrQuota is returned when the YouTube Data API quota is exhausted.
	ErrQuota = &Error{Kind: KindQuota}
	// ErrAuth is returned when the API key is missing or rejected.
	ErrAuth = &Error{Kind: KindAuth}
)

// Error is a YouTube API failure. Use errors.Is with ErrNotFound, ErrQuota, or ErrAuth.
type Error struct {
	Kind     Kind
	Status   int
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
	switch e.Kind {
	case KindNotFound:
		return fmt.Sprintf("%s not found: %s", e.Resource, e.ID)
	case KindQuota:
		return "YouTube API quota exceeded. Try again later."
	case KindAuth:
		return "Invalid or missing YouTube API key."
	default:
		if e.Status != 0 {
			return fmt.Sprintf("YouTube API error (%d)", e.Status)
		}
		return "YouTube API error"
	}
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

func notFound(resource, id string) *Error {
	return &Error{
		Kind:     KindNotFound,
		Status:   404,
		Resource: resource,
		ID:       id,
		Message:  fmt.Sprintf("%s not found: %s", resource, id),
	}
}

func quotaExceeded() *Error {
	return &Error{
		Kind:    KindQuota,
		Status:  403,
		Message: "YouTube API quota exceeded. Try again later.",
	}
}

func authRejected() *Error {
	return &Error{
		Kind:    KindAuth,
		Status:  401,
		Message: "Invalid or missing YouTube API key.",
	}
}

func apiError(status int, body string) *Error {
	return &Error{
		Kind:    KindAPI,
		Status:  status,
		Message: fmt.Sprintf("YouTube API error (%d): %s", status, body),
	}
}
