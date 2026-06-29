package github

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
)

const (
	maxRetries              = 3
	rateLimitRemainingFloor = 10
	secondaryRateLimitDelay = 60 * time.Second
)

type rateLimitTransport struct {
	base http.RoundTripper

	mu    sync.Mutex
	reset time.Time
}

func newRateLimitTransport(base http.RoundTripper) *rateLimitTransport {
	return &rateLimitTransport{base: base}
}

func (t *rateLimitTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	t.waitIfNeeded()
	if err := ensureReplayableBody(req); err != nil {
		return nil, err
	}

	var resp *http.Response
	var err error
	backoff := time.Second

	for attempt := 0; attempt <= maxRetries; attempt++ {
		if attempt > 0 {
			fmt.Fprintf(logWriter(), "github: retry %d/%d after %s\n", attempt, maxRetries, backoff)
			sleep(backoff)
			backoff *= 2
			if req.GetBody != nil {
				req.Body, err = req.GetBody()
				if err != nil {
					return nil, fmt.Errorf("replaying request body: %w", err)
				}
			}
		}

		resp, err = t.base.RoundTrip(req)
		if err != nil {
			return nil, err
		}

		t.recordRateLimit(resp)

		if resp.StatusCode == http.StatusTooManyRequests {
			delay := retryAfterDelay(resp)
			if delay == 0 {
				delay = backoff
			}
			fmt.Fprintf(logWriter(), "github: 429 Too Many Requests, will retry after %s\n", delay)
			drainAndClose(resp)
			backoff = delay
			continue
		}

		if resp.StatusCode == http.StatusForbidden && isSecondaryRateLimit(resp) {
			fmt.Fprintf(logWriter(), "github: secondary rate limit hit, will retry after %s\n", secondaryRateLimitDelay)
			drainAndClose(resp)
			backoff = secondaryRateLimitDelay
			continue
		}

		if resp.StatusCode >= 500 {
			fmt.Fprintf(logWriter(), "github: server error %d, will retry\n", resp.StatusCode)
			drainAndClose(resp)
			continue
		}

		return resp, nil
	}

	return resp, err
}

func ensureReplayableBody(req *http.Request) error {
	if req.Body == nil || req.Body == http.NoBody || req.GetBody != nil {
		return nil
	}

	body, err := io.ReadAll(req.Body)
	if err != nil {
		return fmt.Errorf("reading request body for retry: %w", err)
	}
	if err := req.Body.Close(); err != nil {
		return fmt.Errorf("closing request body after buffering for retry: %w", err)
	}

	req.GetBody = func() (io.ReadCloser, error) {
		return io.NopCloser(bytes.NewReader(body)), nil
	}
	req.Body, err = req.GetBody()
	if err != nil {
		return fmt.Errorf("reopening request body after buffering for retry: %w", err)
	}
	return nil
}

func (t *rateLimitTransport) waitIfNeeded() {
	t.mu.Lock()
	resetAt := t.reset
	t.mu.Unlock()

	if resetAt.IsZero() {
		return
	}
	wait := time.Until(resetAt)
	if wait > 0 {
		fmt.Fprintf(logWriter(), "github: rate limit low, sleeping %s until reset\n", wait.Truncate(time.Second))
		sleep(wait)
	}
}

func (t *rateLimitTransport) recordRateLimit(resp *http.Response) {
	remaining, err := strconv.Atoi(resp.Header.Get("X-RateLimit-Remaining"))
	if err != nil {
		return
	}
	if remaining >= rateLimitRemainingFloor {
		t.mu.Lock()
		t.reset = time.Time{}
		t.mu.Unlock()
		return
	}

	resetUnix, err := strconv.ParseInt(resp.Header.Get("X-RateLimit-Reset"), 10, 64)
	if err != nil {
		return
	}
	resetAt := time.Unix(resetUnix, 0)
	t.mu.Lock()
	t.reset = resetAt
	t.mu.Unlock()
	fmt.Fprintf(logWriter(), "github: rate limit remaining=%d, reset at %s\n", remaining, resetAt.Format(time.RFC3339))
}

func retryAfterDelay(resp *http.Response) time.Duration {
	val := resp.Header.Get("Retry-After")
	if val == "" {
		return 0
	}
	secs, err := strconv.Atoi(val)
	if err != nil {
		return 0
	}
	return time.Duration(secs) * time.Second
}

func isSecondaryRateLimit(resp *http.Response) bool {
	body, err := io.ReadAll(resp.Body)
	resp.Body.Close()
	if err != nil {
		return false
	}
	resp.Body = io.NopCloser(bytes.NewReader(body))
	return strings.Contains(strings.ToLower(string(body)), "secondary rate limit")
}

func drainAndClose(resp *http.Response) {
	if resp.Body != nil {
		io.Copy(io.Discard, resp.Body)
		resp.Body.Close()
	}
}

var (
	sleepFunc   func(time.Duration)
	logWriterFn func() io.Writer
)

func sleep(d time.Duration) {
	if sleepFunc != nil {
		sleepFunc(d)
		return
	}
	time.Sleep(d)
}

func logWriter() io.Writer {
	if logWriterFn != nil {
		return logWriterFn()
	}
	return os.Stderr
}
