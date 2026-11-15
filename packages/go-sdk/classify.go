package lyra

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"unicode/utf8"
)

const (
	// maxMessageLen bounds the YouTube-supplied text copied into Error.Message.
	maxMessageLen = 512
	// maxSnippetLen bounds the raw snippet used when an error body is not JSON.
	maxSnippetLen = 200
)

// googleErrorBody is the standard Google API error envelope.
type googleErrorBody struct {
	Error struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
		Status  string `json:"status"`
		Errors  []struct {
			Reason string `json:"reason"`
		} `json:"errors"`
		Details []struct {
			Reason string `json:"reason"`
		} `json:"details"`
	} `json:"error"`
}

// parseErrorBody returns YouTube's message and first non-empty reason. ok is
// false when the body is not a Google error envelope.
func parseErrorBody(body []byte) (message, reason string, ok bool) {
	var env googleErrorBody
	if err := json.Unmarshal(body, &env); err != nil {
		return "", "", false
	}
	e := env.Error
	if e.Code == 0 && e.Message == "" && e.Status == "" && len(e.Errors) == 0 && len(e.Details) == 0 {
		return "", "", false
	}
	for _, item := range e.Errors {
		if item.Reason != "" {
			return e.Message, item.Reason, true
		}
	}
	for _, item := range e.Details {
		if item.Reason != "" {
			return e.Message, item.Reason, true
		}
	}
	return e.Message, "", true
}

// classify maps a status and YouTube reason to a Kind. Reason takes priority
// over status.
func classify(status int, reason string) Kind {
	switch reason {
	case "keyInvalid", "keyExpired", "API_KEY_INVALID", "API_KEY_EXPIRED":
		return KindAuth
	case "quotaExceeded", "dailyLimitExceeded", "rateLimitExceeded", "userRateLimitExceeded":
		return KindQuota
	}
	switch {
	case status == http.StatusUnauthorized:
		return KindAuth
	case status == http.StatusTooManyRequests:
		return KindQuota
	case status == http.StatusForbidden:
		return KindForbidden
	case status == http.StatusNotFound || strings.HasSuffix(reason, "NotFound"):
		return KindNotFound
	default:
		return KindAPI
	}
}

// retryable reports whether a failed response is worth retrying.
func retryable(status int, reason string) bool {
	switch reason {
	case "rateLimitExceeded", "userRateLimitExceeded":
		return true
	}
	return status == http.StatusTooManyRequests || (status >= 500 && status <= 599)
}

// statusError builds the *Error for a non-2xx response.
func statusError(status int, body []byte, path string, params map[string]string) *Error {
	ytMessage, reason, parsed := parseErrorBody(body)
	kind := classify(status, reason)
	e := &Error{Kind: kind, Status: status, Reason: reason}
	if kind == KindNotFound {
		e.Resource = resourceForPath(path)
		e.ID = resourceID(params, path)
	}

	detail := truncate(strings.TrimSpace(ytMessage), maxMessageLen)
	if !parsed && kind == KindAPI {
		detail = bodySnippet(body)
	}
	switch {
	case detail == "":
		e.Message = defaultMessage(kind, status, e.Resource, e.ID)
	case kind == KindAPI:
		e.Message = fmt.Sprintf("YouTube API error (%d): %s", status, detail)
	default:
		e.Message = detail
	}
	return e
}

// bodySnippet returns a short, single-line excerpt of a non-JSON error body.
// Bodies that look like JSON but are not a Google error envelope (including
// ones cut off by the body cap) yield no snippet, so raw JSON never reaches
// an error message.
func bodySnippet(body []byte) string {
	trimmed := bytes.TrimSpace(body)
	if len(trimmed) == 0 || trimmed[0] == '{' || trimmed[0] == '[' {
		return ""
	}
	return truncate(strings.Join(strings.Fields(string(trimmed)), " "), maxSnippetLen)
}

// truncate cuts s to at most n bytes on a rune boundary, marking the cut.
func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	cut := n
	for cut > 0 && !utf8.RuneStart(s[cut]) {
		cut--
	}
	return s[:cut] + "…"
}
