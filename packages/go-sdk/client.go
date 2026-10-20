package lyra

import (
	"errors"
	"net/http"
)

// Client fetches YouTube videos and channels.
type Client struct {
	http *transport
}

// New returns a client for the YouTube Data API.
// An empty API key is rejected.
func New(apiKey string, opts ...Option) (*Client, error) {
	if apiKey == "" {
		return nil, errors.New("lyra-sdk: API key is required. Get one at https://console.cloud.google.com")
	}

	cfg := config{
		baseURL:    defaultBaseURL,
		maxRetries: defaultMaxRetries,
		httpClient: http.DefaultClient,
	}
	for _, opt := range opts {
		opt(&cfg)
	}
	if cfg.httpClient == nil {
		cfg.httpClient = http.DefaultClient
	}
	if cfg.baseURL == "" {
		cfg.baseURL = defaultBaseURL
	}

	return &Client{http: newTransport(apiKey, cfg)}, nil
}
