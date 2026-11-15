package lyra

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

// retryAfterServer answers the first request with status and a Retry-After
// header, then serves a video.
func retryAfterServer(t *testing.T, status int, retryAfter string, calls *atomic.Int32) *httptest.Server {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if calls.Add(1) == 1 {
			w.Header().Set("Retry-After", retryAfter)
			http.Error(w, "slow down", status)
			return
		}
		writeJSON(t, w, videoList("dQw4w9WgXcQ", "Retry Channel"))
	}))
	t.Cleanup(server.Close)
	return server
}

func TestRetryAfterSecondsIsHonoured(t *testing.T) {
	var calls atomic.Int32
	server := retryAfterServer(t, http.StatusTooManyRequests, "1", &calls)

	client := testClient(t, server.URL, WithMaxRetries(1))
	start := time.Now()
	if _, err := client.Video(context.Background(), "dQw4w9WgXcQ"); err != nil {
		t.Fatal(err)
	}
	if elapsed := time.Since(start); elapsed < 900*time.Millisecond {
		t.Fatalf("retried after %v, want it to wait for Retry-After (about 1s)", elapsed)
	}
	if calls.Load() != 2 {
		t.Fatalf("calls = %d, want 2", calls.Load())
	}
}

func TestContextDeadlineCutsRetryAfterShort(t *testing.T) {
	var calls atomic.Int32
	server := retryAfterServer(t, http.StatusTooManyRequests, "20", &calls)

	client := testClient(t, server.URL, WithMaxRetries(1))
	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()
	start := time.Now()
	_, err := client.Video(ctx, "dQw4w9WgXcQ")
	if !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("err = %v, want context.DeadlineExceeded", err)
	}
	if elapsed := time.Since(start); elapsed > 5*time.Second {
		t.Fatalf("returned after %v, want it to stop at the context deadline", elapsed)
	}
	if calls.Load() != 1 {
		t.Fatalf("calls = %d, want 1", calls.Load())
	}
}

func TestRetryAfterIsCapped(t *testing.T) {
	var calls atomic.Int32
	server := retryAfterServer(t, http.StatusTooManyRequests, "3600", &calls)

	client := testClient(t, server.URL, WithMaxRetries(1))
	// Lower this client's cap so the test stays fast; an uncapped hour-long
	// wait would blow the deadline.
	client.http.maxRetryAfter = 50 * time.Millisecond
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if _, err := client.Video(ctx, "dQw4w9WgXcQ"); err != nil {
		t.Fatalf("err = %v, want the capped wait to retry and succeed", err)
	}
	if calls.Load() != 2 {
		t.Fatalf("calls = %d, want 2", calls.Load())
	}
}

func TestRetryAfterHTTPDateIsHonoured(t *testing.T) {
	// A date an hour out must hold the retry back; the jittered backoff alone
	// (under 300ms on the first retry) would retry well inside the deadline.
	var calls atomic.Int32
	date := time.Now().Add(time.Hour).UTC().Format(http.TimeFormat)
	server := retryAfterServer(t, http.StatusServiceUnavailable, date, &calls)

	client := testClient(t, server.URL, WithMaxRetries(1))
	ctx, cancel := context.WithTimeout(context.Background(), 700*time.Millisecond)
	defer cancel()
	_, err := client.Video(ctx, "dQw4w9WgXcQ")
	if !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("err = %v, want context.DeadlineExceeded while waiting for Retry-After", err)
	}
	if calls.Load() != 1 {
		t.Fatalf("calls = %d, want 1", calls.Load())
	}
}

func TestHugeRetryAfterSecondsWaitsForTheCap(t *testing.T) {
	// 9223372037s overflows time.Duration when multiplied by time.Second; it
	// must clamp to the cap rather than wrap negative and retry immediately.
	var calls atomic.Int32
	server := retryAfterServer(t, http.StatusTooManyRequests, "9223372037", &calls)

	client := testClient(t, server.URL, WithMaxRetries(1))
	client.http.maxRetryAfter = 400 * time.Millisecond
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	start := time.Now()
	if _, err := client.Video(ctx, "dQw4w9WgXcQ"); err != nil {
		t.Fatalf("err = %v, want the capped wait to retry and succeed", err)
	}
	if elapsed := time.Since(start); elapsed < 350*time.Millisecond {
		t.Fatalf("retried after %v, want it to wait for the capped Retry-After (400ms)", elapsed)
	}
	if calls.Load() != 2 {
		t.Fatalf("calls = %d, want 2", calls.Load())
	}
}
