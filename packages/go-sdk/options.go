package lyra

import (
	"net/http"
	"time"
)

const (
	defaultBaseURL    = "https://www.googleapis.com/youtube/v3"
	defaultMaxRetries = 2
	// defaultMaxRetryAfter caps how long a server-requested Retry-After wait may be.
	defaultMaxRetryAfter = 30 * time.Second
)

type config struct {
	baseURL       string
	maxRetries    int
	maxRetryAfter time.Duration
	httpClient    *http.Client
}

// Option configures a Client.
type Option func(*config)

// WithBaseURL overrides the YouTube Data API origin. Use it with httptest.
func WithBaseURL(baseURL string) Option {
	return func(c *config) {
		c.baseURL = baseURL
	}
}

// WithMaxRetries sets how many extra attempts follow a 429, 5xx, or transport error.
func WithMaxRetries(n int) Option {
	return func(c *config) {
		if n < 0 {
			n = 0
		}
		c.maxRetries = n
	}
}

// WithHTTPClient sets the HTTP client used for Data API calls.
func WithHTTPClient(client *http.Client) Option {
	return func(c *config) {
		c.httpClient = client
	}
}
