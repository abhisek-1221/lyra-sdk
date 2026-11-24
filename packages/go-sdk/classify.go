package lyra

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"slices"
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

// parsedError is what classification needs from a Google error envelope.
type parsedError struct {
	message string
	// reason is the most specific reason: the first details[] (ErrorInfo)
	// reason, else the first errors[] reason.
	reason string
	// reasons holds every non-empty reason from details[] and errors[].
	reasons []string
}

// parseErrorBody decodes a Google error envelope. ok is false when the body
// is not one.
func parseErrorBody(body []byte) (p parsedError, ok bool) {
	var env googleErrorBody
	if err := json.Unmarshal(body, &env); err != nil {
		return parsedError{}, false
	}
	e := env.Error
	if e.Code == 0 && e.Message == "" && e.Status == "" && len(e.Errors) == 0 && len(e.Details) == 0 {
		return parsedError{}, false
	}
	p.message = e.Message
	for _, item := range e.Details {
		if item.Reason != "" {
			p.reasons = append(p.reasons, item.Reason)
		}
	}
	for _, item := range e.Errors {
		if item.Reason != "" {
			p.reasons = append(p.reasons, item.Reason)
		}
	}
	if len(p.reasons) > 0 {
		p.reason = p.reasons[0]
	}
	return p, true
}

func isAuthReason(r string) bool {
	switch r {
	case "keyInvalid", "keyExpired", "API_KEY_INVALID", "API_KEY_EXPIRED":
		return true
	}
	return false
}

// isQuotaOrRateLimitReason reports whether r means the quota or a rate limit
// is exhausted.
func isQuotaOrRateLimitReason(r string) bool {
	switch r {
	case "quotaExceeded", "dailyLimitExceeded":
		return true
	}
	return isRateLimitReason(r)
}

func isRateLimitReason(r string) bool {
	return r == "rateLimitExceeded" || r == "userRateLimitExceeded"
}

func isNotFoundReason(r string) bool {
	return strings.HasSuffix(r, "NotFound")
}

// reasonRules maps reasons to a Kind, highest priority first.
var reasonRules = []struct {
	match func(string) bool
	kind  Kind
}{
	{isAuthReason, KindAuth},
	{isQuotaOrRateLimitReason, KindQuota},
	{isNotFoundReason, KindNotFound},
}

// classify maps a status and every reason in the body to a Kind. A 401 is
// always KindAuth. Otherwise a reason that maps to a specific Kind wins over
// the status, with priority Auth > Quota (including rate limits) > NotFound;
// failing that the status decides.
func classify(status int, reasons []string) Kind {
	if status == http.StatusUnauthorized {
		return KindAuth
	}
	for _, rule := range reasonRules {
		if slices.ContainsFunc(reasons, rule.match) {
			return rule.kind
		}
	}
	switch {
	case status == http.StatusTooManyRequests:
		return KindQuota
	case status == http.StatusForbidden:
		return KindForbidden
	case status == http.StatusNotFound:
		return KindNotFound
	default:
		return KindAPI
	}
}

// retryable reports whether a failed response is worth retrying.
func retryable(status int, reasons []string) bool {
	if slices.ContainsFunc(reasons, isRateLimitReason) {
		return true
	}
	return status == http.StatusTooManyRequests || (status >= 500 && status <= 599)
}

// statusError builds the *Error for a non-2xx response and reports whether
// the request is worth retrying.
func statusError(status int, body []byte, path string, params map[string]string) (*Error, bool) {
	p, parsed := parseErrorBody(body)
	kind := classify(status, p.reasons)
	e := &Error{Kind: kind, Status: status, Reason: p.reason}
	if kind == KindNotFound {
		e.Resource = resourceForPath(path)
		e.ID = resourceID(params, path)
	}

	detail := truncate(strings.TrimSpace(p.message), maxMessageLen)
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
	return e, retryable(status, p.reasons)
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
