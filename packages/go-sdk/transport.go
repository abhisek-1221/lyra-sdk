package lyra

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/rand/v2"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

const (
	// maxSuccessBodyBytes caps a 2xx body; a body over the cap is an error,
	// never a silent truncation.
	maxSuccessBodyBytes = 8 << 20
	// maxErrorBodyBytes caps how much of a non-2xx body is read for classification.
	maxErrorBodyBytes = 64 << 10
)

const (
	// baseBackoff is the first retry's backoff ceiling; it doubles per attempt.
	baseBackoff = 300 * time.Millisecond
	// maxBackoff caps the exponential backoff ceiling.
	maxBackoff = 10 * time.Second
	// maxBackoffShift bounds the doubling so the shift can't overflow;
	// baseBackoff<<6 already exceeds maxBackoff.
	maxBackoffShift = 6
)

// maxRetryAfter caps how long a server-requested Retry-After wait may be.
var maxRetryAfter = 30 * time.Second

type transport struct {
	apiKey     string
	baseURL    string
	maxRetries int
	httpClient *http.Client
}

func newTransport(apiKey string, cfg config) *transport {
	return &transport{
		apiKey:     apiKey,
		baseURL:    strings.TrimRight(cfg.baseURL, "/"),
		maxRetries: cfg.maxRetries,
		httpClient: redirectSafeClient(cfg.httpClient),
	}
}

const apiKeyHeader = "X-Goog-Api-Key"

// redirectSafeClient returns a shallow copy of client whose redirect policy
// drops the API key header when a redirect leaves the original host. The
// caller's client is left untouched and its CheckRedirect still applies.
func redirectSafeClient(client *http.Client) *http.Client {
	safe := *client
	callerCheck := client.CheckRedirect
	safe.CheckRedirect = func(req *http.Request, via []*http.Request) error {
		if len(via) > 0 && req.URL.Host != via[0].URL.Host {
			req.Header.Del(apiKeyHeader)
		}
		if callerCheck != nil {
			return callerCheck(req, via)
		}
		if len(via) >= 10 {
			return errors.New("stopped after 10 redirects")
		}
		return nil
	}
	return &safe
}

func getJSON[T any](ctx context.Context, t *transport, path string, params map[string]string) (T, error) {
	var out T
	err := t.get(ctx, path, params, &out)
	return out, err
}

func (t *transport) get(ctx context.Context, path string, params map[string]string, dest any) error {
	var lastErr error

	for attempt := 0; attempt <= t.maxRetries; attempt++ {
		if err := ctx.Err(); err != nil {
			return err
		}

		req, err := http.NewRequestWithContext(ctx, http.MethodGet, t.buildURL(path, params), nil)
		if err != nil {
			return err
		}
		req.Header.Set(apiKeyHeader, t.apiKey)

		resp, err := t.httpClient.Do(req)
		if err != nil {
			if ctxErr := ctx.Err(); ctxErr != nil {
				return ctxErr
			}
			lastErr = err
			if attempt < t.maxRetries {
				if sleepErr := sleepBackoff(ctx, attempt); sleepErr != nil {
					return sleepErr
				}
				continue
			}
			break
		}

		success := resp.StatusCode >= 200 && resp.StatusCode < 300
		limit := int64(maxErrorBodyBytes)
		if success {
			limit = maxSuccessBodyBytes
		}
		body, readErr := io.ReadAll(io.LimitReader(resp.Body, limit+1))
		resp.Body.Close()
		if readErr != nil {
			if ctxErr := ctx.Err(); ctxErr != nil {
				return ctxErr
			}
			lastErr = readErr
			if attempt < t.maxRetries {
				if sleepErr := sleepBackoff(ctx, attempt); sleepErr != nil {
					return sleepErr
				}
				continue
			}
			break
		}

		if success {
			if int64(len(body)) > limit {
				return fmt.Errorf("lyra-sdk: %s response body exceeds %d bytes", path, limit)
			}
			return json.Unmarshal(body, dest)
		}

		if int64(len(body)) > limit {
			body = body[:limit]
		}
		apiErr, retry := statusError(resp.StatusCode, body, path, params)
		// Out of retries, the last real HTTP error is returned unchanged.
		if !retry || attempt == t.maxRetries {
			return apiErr
		}
		delay, ok := retryAfter(resp.Header.Get("Retry-After"))
		if ok {
			delay = min(delay, maxRetryAfter)
		} else {
			delay = backoff(attempt)
		}
		if sleepErr := sleep(ctx, delay); sleepErr != nil {
			return sleepErr
		}
	}

	message := "Request failed after retries"
	if lastErr != nil {
		message = lastErr.Error()
	}
	return &Error{Kind: KindAPI, Message: message, cause: lastErr}
}

func (t *transport) buildURL(path string, params map[string]string) string {
	query := url.Values{}
	for k, v := range params {
		query.Set(k, v)
	}
	return t.baseURL + "/" + path + "?" + query.Encode()
}

func sleepBackoff(ctx context.Context, attempt int) error {
	return sleep(ctx, backoff(attempt))
}

// backoff returns a "full jitter" delay: a random duration in [0, base), where
// base doubles from baseBackoff on each attempt and is capped at maxBackoff.
func backoff(attempt int) time.Duration {
	base := maxBackoff
	if attempt < maxBackoffShift {
		base = min(baseBackoff<<attempt, maxBackoff)
	}
	return rand.N(base)
}

// retryAfter parses a Retry-After header value: delta-seconds or an HTTP-date.
func retryAfter(value string) (time.Duration, bool) {
	value = strings.TrimSpace(value)
	if value == "" {
		return 0, false
	}
	if secs, err := strconv.Atoi(value); err == nil {
		if secs < 0 {
			return 0, false
		}
		return time.Duration(secs) * time.Second, true
	}
	when, err := http.ParseTime(value)
	if err != nil {
		return 0, false
	}
	return max(time.Until(when), 0), true
}

func sleep(ctx context.Context, delay time.Duration) error {
	timer := time.NewTimer(delay)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}

func resourceForPath(path string) string {
	switch path {
	case "channels":
		return "Channel"
	case "videos":
		return "Video"
	case "search":
		return "SearchResult"
	case "playlistItems":
		return "PlaylistItem"
	case "playlists":
		return "Playlist"
	case "commentThreads":
		return "CommentThread"
	case "comments":
		return "Comment"
	default:
		return path
	}
}

func resourceID(params map[string]string, path string) string {
	for _, key := range []string{"id", "videoId", "playlistId", "channelId", "parentId", "allThreadsRelatedToChannelId"} {
		if params[key] != "" {
			return params[key]
		}
	}
	return path
}
