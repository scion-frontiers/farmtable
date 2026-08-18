package decomposer

import (
	"context"
	"errors"
	"fmt"
	"log"
	"os"
	"testing"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// testLogger returns a logger that discards output (keeps test output clean).
func testLogger() *log.Logger {
	return log.New(os.Stderr, "", 0)
}

// fastRetryConfig returns a config with tiny delays for fast tests.
func fastRetryConfig(maxRetries int) retryConfig {
	return retryConfig{
		MaxRetries:   maxRetries,
		InitialDelay: 1 * time.Millisecond,
		MaxDelay:     10 * time.Millisecond,
		Jitter:       false,
	}
}

func TestRetryWithBackoff_SucceedsFirstTry(t *testing.T) {
	callCount := 0
	err := retryWithBackoff(context.Background(), fastRetryConfig(3), "test-op", testLogger(),
		func(error) bool { return true },
		func() error {
			callCount++
			return nil
		},
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if callCount != 1 {
		t.Errorf("call count = %d, want 1", callCount)
	}
}

func TestRetryWithBackoff_RetriesTransientErrors(t *testing.T) {
	callCount := 0
	transientErr := fmt.Errorf("transient failure")

	err := retryWithBackoff(context.Background(), fastRetryConfig(3), "test-op", testLogger(),
		func(err error) bool { return err == transientErr },
		func() error {
			callCount++
			if callCount < 3 {
				return transientErr
			}
			return nil
		},
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if callCount != 3 {
		t.Errorf("call count = %d, want 3 (failed twice, succeeded on third)", callCount)
	}
}

func TestRetryWithBackoff_GivesUpAfterMaxRetries(t *testing.T) {
	callCount := 0
	persistentErr := fmt.Errorf("persistent failure")

	err := retryWithBackoff(context.Background(), fastRetryConfig(3), "test-op", testLogger(),
		func(error) bool { return true },
		func() error {
			callCount++
			return persistentErr
		},
	)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if !errors.Is(err, persistentErr) {
		t.Errorf("error = %v, want %v", err, persistentErr)
	}
	// MaxRetries=3 means 4 total attempts (initial + 3 retries).
	if callCount != 4 {
		t.Errorf("call count = %d, want 4 (1 initial + 3 retries)", callCount)
	}
}

func TestRetryWithBackoff_RespectsContextCancellation(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	callCount := 0

	err := retryWithBackoff(ctx, fastRetryConfig(5), "test-op", testLogger(),
		func(error) bool { return true },
		func() error {
			callCount++
			if callCount == 1 {
				// Cancel the context after first call so the backoff sleep is interrupted.
				cancel()
			}
			return fmt.Errorf("transient")
		},
	)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if !errors.Is(err, context.Canceled) {
		t.Errorf("error = %v, want context.Canceled", err)
	}
	// Should have been called once, then context cancellation prevented further retries.
	if callCount != 1 {
		t.Errorf("call count = %d, want 1", callCount)
	}
}

func TestRetryWithBackoff_NonTransientErrorStops(t *testing.T) {
	callCount := 0
	nonTransientErr := fmt.Errorf("permission denied")

	err := retryWithBackoff(context.Background(), fastRetryConfig(3), "test-op", testLogger(),
		func(err error) bool { return false }, // nothing is transient
		func() error {
			callCount++
			return nonTransientErr
		},
	)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if !errors.Is(err, nonTransientErr) {
		t.Errorf("error = %v, want %v", err, nonTransientErr)
	}
	if callCount != 1 {
		t.Errorf("call count = %d, want 1 (non-transient should not retry)", callCount)
	}
}

func TestIsTransientGRPC(t *testing.T) {
	tests := []struct {
		code codes.Code
		want bool
	}{
		{codes.Unavailable, true},
		{codes.DeadlineExceeded, true},
		{codes.Aborted, true},
		{codes.Internal, true},
		{codes.ResourceExhausted, true},
		{codes.Unauthenticated, true},
		// Non-transient codes.
		{codes.OK, false},
		{codes.NotFound, false},
		{codes.PermissionDenied, false},
		{codes.InvalidArgument, false},
		{codes.AlreadyExists, false},
		{codes.Unimplemented, false},
		{codes.FailedPrecondition, false},
		{codes.Canceled, false},
	}

	for _, tt := range tests {
		err := status.Error(tt.code, "test error")
		got := isTransientGRPC(err)
		if got != tt.want {
			t.Errorf("isTransientGRPC(code=%v) = %v, want %v", tt.code, got, tt.want)
		}
	}
}
