package github

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strconv"
	"sync/atomic"
	"testing"
	"time"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

func init() {
	sleepFunc = func(time.Duration) {}
	logWriterFn = func() io.Writer { return io.Discard }
}

func TestRateLimitTransport_RetriesOn5xx(t *testing.T) {
	var calls atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		n := calls.Add(1)
		if n <= 2 {
			w.WriteHeader(http.StatusBadGateway)
			return
		}
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	}))
	defer srv.Close()

	rt := newRateLimitTransport(http.DefaultTransport)
	req, _ := http.NewRequest("GET", srv.URL, nil)
	resp, err := rt.RoundTrip(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("StatusCode = %d, want 200", resp.StatusCode)
	}
	if got := int(calls.Load()); got != 3 {
		t.Errorf("calls = %d, want 3 (1 initial + 2 retries then success)", got)
	}
}

func TestRateLimitTransport_RetriesRequestBody(t *testing.T) {
	const wantBody = `{"query":"mutation { doThing }"}`
	var calls atomic.Int32
	rt := newRateLimitTransport(roundTripFunc(func(req *http.Request) (*http.Response, error) {
		body, err := io.ReadAll(req.Body)
		if err != nil {
			return nil, err
		}
		if string(body) != wantBody {
			t.Fatalf("attempt %d body = %q, want %q", calls.Load()+1, string(body), wantBody)
		}

		statusCode := http.StatusOK
		if calls.Add(1) == 1 {
			statusCode = http.StatusBadGateway
		}
		return &http.Response{
			StatusCode: statusCode,
			Header:     http.Header{},
			Body:       io.NopCloser(bytes.NewReader(nil)),
			Request:    req,
		}, nil
	}))

	req, err := http.NewRequest("POST", "https://api.github.example/graphql", bytes.NewBufferString(wantBody))
	if err != nil {
		t.Fatalf("NewRequest: %v", err)
	}
	req.GetBody = nil

	resp, err := rt.RoundTrip(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("StatusCode = %d, want 200", resp.StatusCode)
	}
	if got := int(calls.Load()); got != 2 {
		t.Errorf("calls = %d, want 2", got)
	}
}

func TestRateLimitTransport_ExhaustsRetries(t *testing.T) {
	var calls atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		w.WriteHeader(http.StatusBadGateway)
	}))
	defer srv.Close()

	rt := newRateLimitTransport(http.DefaultTransport)
	req, _ := http.NewRequest("GET", srv.URL, nil)
	resp, err := rt.RoundTrip(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusBadGateway {
		t.Errorf("StatusCode = %d, want 502 after exhausting retries", resp.StatusCode)
	}
	if got := int(calls.Load()); got != maxRetries+1 {
		t.Errorf("calls = %d, want %d", got, maxRetries+1)
	}
}

func TestRateLimitTransport_429RespectsRetryAfter(t *testing.T) {
	var calls atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		n := calls.Add(1)
		if n == 1 {
			w.Header().Set("Retry-After", "5")
			w.WriteHeader(http.StatusTooManyRequests)
			return
		}
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	}))
	defer srv.Close()

	var sleeps []time.Duration
	sleepFunc = func(d time.Duration) { sleeps = append(sleeps, d) }
	defer func() { sleepFunc = func(time.Duration) {} }()

	rt := newRateLimitTransport(http.DefaultTransport)
	req, _ := http.NewRequest("GET", srv.URL, nil)
	resp, err := rt.RoundTrip(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("StatusCode = %d, want 200", resp.StatusCode)
	}
	if len(sleeps) == 0 {
		t.Fatal("expected at least one sleep")
	}
	if sleeps[0] != 5*time.Second {
		t.Errorf("sleep duration = %v, want 5s from Retry-After", sleeps[0])
	}
}

func TestRateLimitTransport_SecondaryRateLimit(t *testing.T) {
	var calls atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		n := calls.Add(1)
		if n == 1 {
			w.WriteHeader(http.StatusForbidden)
			w.Write([]byte(`{"message":"You have exceeded a secondary rate limit"}`))
			return
		}
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	}))
	defer srv.Close()

	var sleeps []time.Duration
	sleepFunc = func(d time.Duration) { sleeps = append(sleeps, d) }
	defer func() { sleepFunc = func(time.Duration) {} }()

	rt := newRateLimitTransport(http.DefaultTransport)
	req, _ := http.NewRequest("GET", srv.URL, nil)
	resp, err := rt.RoundTrip(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("StatusCode = %d, want 200", resp.StatusCode)
	}
	if len(sleeps) == 0 {
		t.Fatal("expected at least one sleep")
	}
	if sleeps[0] != secondaryRateLimitDelay {
		t.Errorf("sleep duration = %v, want %v for secondary rate limit", sleeps[0], secondaryRateLimitDelay)
	}
}

func TestRateLimitTransport_PreemptiveSleepOnLowRemaining(t *testing.T) {
	resetTime := time.Now().Add(30 * time.Second)
	var calls atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		n := calls.Add(1)
		if n == 1 {
			w.Header().Set("X-RateLimit-Remaining", "5")
			w.Header().Set("X-RateLimit-Reset", strconv.FormatInt(resetTime.Unix(), 10))
		}
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	}))
	defer srv.Close()

	var sleeps []time.Duration
	sleepFunc = func(d time.Duration) { sleeps = append(sleeps, d) }
	defer func() { sleepFunc = func(time.Duration) {} }()

	rt := newRateLimitTransport(http.DefaultTransport)

	req1, _ := http.NewRequest("GET", srv.URL, nil)
	resp1, err := rt.RoundTrip(req1)
	if err != nil {
		t.Fatalf("req1: unexpected error: %v", err)
	}
	resp1.Body.Close()

	req2, _ := http.NewRequest("GET", srv.URL, nil)
	resp2, err := rt.RoundTrip(req2)
	if err != nil {
		t.Fatalf("req2: unexpected error: %v", err)
	}
	resp2.Body.Close()

	if len(sleeps) == 0 {
		t.Fatal("expected preemptive sleep before second request, got none")
	}
	if sleeps[0] <= 0 {
		t.Errorf("preemptive sleep duration = %v, want > 0", sleeps[0])
	}
}

func TestRateLimitTransport_403WithoutSecondaryIsNotRetried(t *testing.T) {
	var calls atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		w.WriteHeader(http.StatusForbidden)
		w.Write([]byte(`{"message":"Resource not accessible by integration"}`))
	}))
	defer srv.Close()

	rt := newRateLimitTransport(http.DefaultTransport)
	req, _ := http.NewRequest("GET", srv.URL, nil)
	resp, err := rt.RoundTrip(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusForbidden {
		t.Errorf("StatusCode = %d, want 403", resp.StatusCode)
	}
	if got := int(calls.Load()); got != 1 {
		t.Errorf("calls = %d, want 1 (no retry for non-rate-limit 403)", got)
	}
}

func TestRateLimitTransport_LogsOnRateLimit(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-RateLimit-Remaining", "3")
		w.Header().Set("X-RateLimit-Reset", strconv.FormatInt(time.Now().Add(10*time.Second).Unix(), 10))
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	}))
	defer srv.Close()

	var buf bytes.Buffer
	logWriterFn = func() io.Writer { return &buf }
	defer func() { logWriterFn = func() io.Writer { return io.Discard } }()

	rt := newRateLimitTransport(http.DefaultTransport)
	req, _ := http.NewRequest("GET", srv.URL, nil)
	resp, err := rt.RoundTrip(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	resp.Body.Close()

	logged := buf.String()
	if logged == "" {
		t.Error("expected log output when rate limit is low, got nothing")
	}
	expected := "rate limit remaining="
	if !contains(logged, expected) {
		t.Errorf("log output %q does not contain %q", logged, expected)
	}
}

func TestRetryAfterDelay(t *testing.T) {
	tests := []struct {
		header string
		want   time.Duration
	}{
		{"10", 10 * time.Second},
		{"", 0},
		{"not-a-number", 0},
	}
	for _, tt := range tests {
		t.Run(fmt.Sprintf("header=%q", tt.header), func(t *testing.T) {
			resp := &http.Response{Header: http.Header{}}
			if tt.header != "" {
				resp.Header.Set("Retry-After", tt.header)
			}
			got := retryAfterDelay(resp)
			if got != tt.want {
				t.Errorf("retryAfterDelay() = %v, want %v", got, tt.want)
			}
		})
	}
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && containsBytes(s, substr))
}

func containsBytes(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
