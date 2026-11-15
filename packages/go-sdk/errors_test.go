package lyra

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
)

// googleError builds a YouTube Data API error envelope with a legacy
// errors[].reason entry.
func googleError(code int, status, reason, message string) map[string]any {
	return map[string]any{
		"error": map[string]any{
			"code":    code,
			"message": message,
			"status":  status,
			"errors": []any{
				map[string]any{"message": message, "domain": "youtube.error", "reason": reason},
			},
		},
	}
}

// serveError serves body with status: a string is sent verbatim as HTML, any
// other value as JSON. Write errors are ignored because the client may stop
// reading at its body cap.
func serveError(t *testing.T, status int, body any) *httptest.Server {
	t.Helper()
	payload, contentType := []byte(nil), "application/json"
	if s, ok := body.(string); ok {
		payload, contentType = []byte(s), "text/html"
	} else {
		var err error
		if payload, err = json.Marshal(body); err != nil {
			t.Fatal(err)
		}
	}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", contentType)
		w.WriteHeader(status)
		_, _ = w.Write(payload)
	}))
	t.Cleanup(server.Close)
	return server
}

func TestErrorsClassifiedFromYouTubeReason(t *testing.T) {
	tests := []struct {
		name       string
		status     int
		body       any
		wantKind   Kind
		wantReason string
		wantIs     error
	}{
		{
			name:   "quota exceeded",
			status: http.StatusForbidden,
			body: googleError(403, "PERMISSION_DENIED", "quotaExceeded",
				"The request cannot be completed because you have exceeded your quota."),
			wantKind: KindQuota, wantReason: "quotaExceeded", wantIs: ErrQuota,
		},
		{
			name:   "comments disabled",
			status: http.StatusForbidden,
			body: googleError(403, "PERMISSION_DENIED", "commentsDisabled",
				"The video identified by the videoId parameter has disabled comments."),
			wantKind: KindForbidden, wantReason: "commentsDisabled", wantIs: ErrForbidden,
		},
		{
			name:     "forbidden",
			status:   http.StatusForbidden,
			body:     googleError(403, "PERMISSION_DENIED", "forbidden", "Access forbidden."),
			wantKind: KindForbidden, wantReason: "forbidden", wantIs: ErrForbidden,
		},
		{
			name:     "key invalid",
			status:   http.StatusBadRequest,
			body:     googleError(400, "INVALID_ARGUMENT", "keyInvalid", "API key not valid. Please pass a valid API key."),
			wantKind: KindAuth, wantReason: "keyInvalid", wantIs: ErrAuth,
		},
		{
			name:   "key invalid in details",
			status: http.StatusBadRequest,
			body: map[string]any{
				"error": map[string]any{
					"code":    400,
					"message": "API key not valid. Please pass a valid API key.",
					"status":  "INVALID_ARGUMENT",
					"details": []any{
						map[string]any{
							"@type":    "type.googleapis.com/google.rpc.ErrorInfo",
							"reason":   "API_KEY_INVALID",
							"domain":   "googleapis.com",
							"metadata": map[string]string{"service": "youtube.googleapis.com"},
						},
					},
				},
			},
			wantKind: KindAuth, wantReason: "API_KEY_INVALID", wantIs: ErrAuth,
		},
		{
			// Verbatim body YouTube returns for a bad key: the legacy errors[]
			// reason is the generic badRequest, the ErrorInfo carries the detail.
			name:     "key invalid with generic legacy reason",
			status:   http.StatusBadRequest,
			body:     json.RawMessage(`{"error":{"code":400,"message":"API key not valid. Please pass a valid API key.","errors":[{"message":"API key not valid. Please pass a valid API key.","domain":"global","reason":"badRequest"}],"status":"INVALID_ARGUMENT","details":[{"@type":"type.googleapis.com/google.rpc.ErrorInfo","reason":"API_KEY_INVALID","domain":"googleapis.com","metadata":{"service":"youtube.googleapis.com"}},{"@type":"type.googleapis.com/google.rpc.LocalizedMessage","locale":"en-US","message":"API key not valid. Please pass a valid API key."}]}}`),
			wantKind: KindAuth, wantReason: "API_KEY_INVALID", wantIs: ErrAuth,
		},
		{
			name:   "unauthorized",
			status: http.StatusUnauthorized,
			body: googleError(401, "UNAUTHENTICATED", "authError",
				"Request had invalid authentication credentials."),
			wantKind: KindAuth, wantReason: "authError", wantIs: ErrAuth,
		},
		{
			// 401 is always auth, whatever reason the body carries.
			name:   "unauthorized with not-found reason",
			status: http.StatusUnauthorized,
			body: googleError(401, "UNAUTHENTICATED", "channelNotFound",
				"Request had invalid authentication credentials."),
			wantKind: KindAuth, wantReason: "channelNotFound", wantIs: ErrAuth,
		},
		{
			name:   "video not found",
			status: http.StatusNotFound,
			body: googleError(404, "NOT_FOUND", "videoNotFound",
				"The video identified by the videoId parameter could not be found."),
			wantKind: KindNotFound, wantReason: "videoNotFound", wantIs: ErrNotFound,
		},
		{
			name:   "too many requests",
			status: http.StatusTooManyRequests,
			body: googleError(429, "RESOURCE_EXHAUSTED", "rateLimitExceeded",
				"The request cannot be completed because you have exceeded your rate limit."),
			wantKind: KindQuota, wantReason: "rateLimitExceeded", wantIs: ErrQuota,
		},
		{
			name:     "service unavailable",
			status:   http.StatusServiceUnavailable,
			body:     googleError(503, "UNAVAILABLE", "backendError", "The service is currently unavailable."),
			wantKind: KindAPI, wantReason: "backendError",
		},
		{
			name:     "non-JSON bad gateway",
			status:   http.StatusBadGateway,
			body:     "<html><body><h1>502 Bad Gateway</h1></body></html>",
			wantKind: KindAPI, wantReason: "",
		},
	}
	sentinels := []error{ErrNotFound, ErrQuota, ErrAuth, ErrForbidden}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := serveError(t, tt.status, tt.body)
			client := testClient(t, server.URL)

			_, err := client.Video(context.Background(), "dQw4w9WgXcQ")
			var apiErr *Error
			if !errors.As(err, &apiErr) {
				t.Fatalf("err = %#v, want *Error", err)
			}
			if apiErr.Kind != tt.wantKind {
				t.Errorf("Kind = %v, want %v", apiErr.Kind, tt.wantKind)
			}
			if apiErr.Status != tt.status {
				t.Errorf("Status = %d, want %d", apiErr.Status, tt.status)
			}
			if apiErr.Reason != tt.wantReason {
				t.Errorf("Reason = %q, want %q", apiErr.Reason, tt.wantReason)
			}
			if msg := err.Error(); strings.ContainsAny(msg, "{}") || msg == "" {
				t.Errorf("Error() = %q, want YouTube's message without raw JSON", msg)
			}
			for _, sentinel := range sentinels {
				if got, want := errors.Is(err, sentinel), sentinel == tt.wantIs; got != want {
					t.Errorf("errors.Is(err, %v) = %v, want %v", sentinel.(*Error).Kind, got, want)
				}
			}
		})
	}
}

func TestCommentsDisabledIsForbiddenNotQuota(t *testing.T) {
	server := serveError(t, http.StatusForbidden, googleError(403, "PERMISSION_DENIED", "commentsDisabled",
		"The video identified by the <code><a href=\"/youtube/v3/docs/commentThreads/list#videoId\">videoId</a></code> parameter has disabled comments."))
	client := testClient(t, server.URL)

	_, err := client.Comments(context.Background(), "dQw4w9WgXcQ", CommentOptions{})
	if !errors.Is(err, ErrForbidden) {
		t.Fatalf("err = %v, want ErrForbidden", err)
	}
	if errors.Is(err, ErrQuota) {
		t.Fatalf("err = %v, must not match ErrQuota", err)
	}
}

func TestRetryExhaustionKeepsLastHTTPError(t *testing.T) {
	var calls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		w.WriteHeader(http.StatusServiceUnavailable)
		writeJSON(t, w, googleError(503, "UNAVAILABLE", "backendError", "The service is currently unavailable."))
	}))
	defer server.Close()

	client := testClient(t, server.URL, WithMaxRetries(1))
	_, err := client.Video(context.Background(), "dQw4w9WgXcQ")
	var apiErr *Error
	if !errors.As(err, &apiErr) {
		t.Fatalf("err = %#v, want *Error", err)
	}
	if apiErr.Status != http.StatusServiceUnavailable || apiErr.Reason != "backendError" || apiErr.Kind != KindAPI {
		t.Fatalf("err = %+v, want Status 503, Reason backendError, KindAPI", apiErr)
	}
	if calls.Load() != 2 {
		t.Fatalf("calls = %d, want 2", calls.Load())
	}
}

func TestForbiddenRateLimitIsRetried(t *testing.T) {
	for _, reason := range []string{"rateLimitExceeded", "userRateLimitExceeded"} {
		t.Run(reason, func(t *testing.T) {
			var calls atomic.Int32
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if calls.Add(1) == 1 {
					w.WriteHeader(http.StatusForbidden)
					writeJSON(t, w, googleError(403, "PERMISSION_DENIED", reason, "Rate limit exceeded."))
					return
				}
				writeJSON(t, w, videoList("dQw4w9WgXcQ", "Retry Channel"))
			}))
			defer server.Close()

			client := testClient(t, server.URL, WithMaxRetries(1))
			if _, err := client.Video(context.Background(), "dQw4w9WgXcQ"); err != nil {
				t.Fatal(err)
			}
			if calls.Load() != 2 {
				t.Fatalf("calls = %d, want 2", calls.Load())
			}
		})
	}
}

func TestOtherForbiddenIsNotRetried(t *testing.T) {
	var calls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		w.WriteHeader(http.StatusForbidden)
		writeJSON(t, w, googleError(403, "PERMISSION_DENIED", "quotaExceeded", "Quota exceeded."))
	}))
	defer server.Close()

	client := testClient(t, server.URL, WithMaxRetries(2))
	if _, err := client.Video(context.Background(), "dQw4w9WgXcQ"); !errors.Is(err, ErrQuota) {
		t.Fatalf("err = %v, want ErrQuota", err)
	}
	if calls.Load() != 1 {
		t.Fatalf("calls = %d, want 1", calls.Load())
	}
}

func TestOversizedErrorBodyGivesBoundedMessage(t *testing.T) {
	const limit = 1024
	huge := strings.Repeat("x", 1<<20)
	tests := []struct {
		name string
		body any
	}{
		{name: "long YouTube message under the cap", body: googleError(500, "INTERNAL", "backendError", strings.Repeat("y", 16<<10))},
		{name: "huge YouTube message over the cap", body: googleError(500, "INTERNAL", "backendError", huge)},
		{name: "huge JSON body cut off by the cap", body: map[string]any{"error": map[string]any{
			"code": 500, "padding": huge, "message": "late",
		}}},
		{name: "huge non-JSON body", body: "<html>" + huge + "</html>"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := serveError(t, http.StatusInternalServerError, tt.body)
			client := testClient(t, server.URL)

			_, err := client.Video(context.Background(), "dQw4w9WgXcQ")
			var apiErr *Error
			if !errors.As(err, &apiErr) || apiErr.Status != http.StatusInternalServerError {
				t.Fatalf("err = %#v, want *Error with Status 500", err)
			}
			msg := err.Error()
			if len(msg) > limit {
				t.Fatalf("len(Error()) = %d, want <= %d", len(msg), limit)
			}
			if strings.ContainsAny(msg, "{}") {
				t.Fatalf("Error() contains raw JSON: %q", msg)
			}
		})
	}
}

func TestNonJSONErrorBodyKeepsShortSnippet(t *testing.T) {
	server := serveError(t, http.StatusBadGateway, "<html><body><h1>502 Bad Gateway</h1></body></html>")
	client := testClient(t, server.URL)

	_, err := client.Video(context.Background(), "dQw4w9WgXcQ")
	if err == nil || !strings.Contains(err.Error(), "502 Bad Gateway") {
		t.Fatalf("err = %v, want message with body snippet", err)
	}
}

func TestKindValuesAndNames(t *testing.T) {
	tests := []struct {
		kind  Kind
		value int
		name  string
	}{
		{KindAPI, 0, "KindAPI"},
		{KindNotFound, 1, "KindNotFound"},
		{KindQuota, 2, "KindQuota"},
		{KindAuth, 3, "KindAuth"},
		{KindForbidden, 4, "KindForbidden"},
	}
	for _, tt := range tests {
		if int(tt.kind) != tt.value {
			t.Errorf("%s = %d, want %d", tt.name, int(tt.kind), tt.value)
		}
		if got := tt.kind.String(); got != tt.name {
			t.Errorf("Kind(%d).String() = %q, want %q", tt.value, got, tt.name)
		}
	}
}
