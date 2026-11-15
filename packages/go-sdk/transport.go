package lyra

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

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

		body, readErr := io.ReadAll(resp.Body)
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

		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			if err := json.Unmarshal(body, dest); err != nil {
				return err
			}
			return nil
		}

		if retryable(resp.StatusCode) && attempt < t.maxRetries {
			lastErr = apiError(resp.StatusCode, string(body))
			if sleepErr := sleepBackoff(ctx, attempt); sleepErr != nil {
				return sleepErr
			}
			continue
		}

		return statusError(resp.StatusCode, string(body), path, params)
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

func retryable(status int) bool {
	return status == http.StatusTooManyRequests || (status >= 500 && status <= 599)
}

func sleepBackoff(ctx context.Context, attempt int) error {
	delay := time.Duration(1<<attempt) * 300 * time.Millisecond
	timer := time.NewTimer(delay)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}

func statusError(status int, body, path string, params map[string]string) *Error {
	if status == http.StatusUnauthorized || (status == http.StatusForbidden && strings.Contains(body, "API key")) {
		return authRejected()
	}
	if status == http.StatusForbidden {
		return quotaExceeded()
	}
	if status == http.StatusNotFound {
		return notFound(resourceForPath(path), resourceID(params, path))
	}
	return apiError(status, body)
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
