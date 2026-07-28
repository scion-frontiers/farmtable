package decomposer

import (
	"context"
	"fmt"
	"log"
	"math"
	"math/rand"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// retryConfig controls retry behavior for retryWithBackoff.
type retryConfig struct {
	MaxRetries   int
	InitialDelay time.Duration
	MaxDelay     time.Duration
	Jitter       bool // add random jitter to avoid thundering herd
}

// Default retry configurations for different call types.
var (
	defaultWriterRetry = retryConfig{
		MaxRetries:   5,
		InitialDelay: 500 * time.Millisecond,
		MaxDelay:     10 * time.Second,
		Jitter:       true,
	}
	defaultLLMRetry = retryConfig{
		MaxRetries:   3,
		InitialDelay: 1 * time.Second,
		MaxDelay:     30 * time.Second,
		Jitter:       true,
	}
)

// retryWithBackoff executes fn up to cfg.MaxRetries+1 times total with
// exponential backoff. isTransient determines which errors are retryable.
// Each retry and eventual success/failure is logged with the given label.
// Context cancellation is checked between retries.
func retryWithBackoff(ctx context.Context, cfg retryConfig, label string, logger *log.Logger, isTransient func(error) bool, fn func() error) error {
	var err error
	for attempt := 0; attempt <= cfg.MaxRetries; attempt++ {
		if attempt > 0 {
			// Exponential backoff: initialDelay * 2^(attempt-1), capped at maxDelay.
			delay := time.Duration(float64(cfg.InitialDelay) * math.Pow(2, float64(attempt-1)))
			if delay > cfg.MaxDelay {
				delay = cfg.MaxDelay
			}
			if cfg.Jitter {
				// Multiply delay by (0.5 + rand*0.5) to spread concurrent retries.
				delay = time.Duration(float64(delay) * (0.5 + rand.Float64()*0.5))
			}

			logger.Printf("[retry] %s failed (attempt %d/%d, backoff %v): %v",
				label, attempt, cfg.MaxRetries+1, delay.Round(time.Millisecond), err)

			select {
			case <-time.After(delay):
			case <-ctx.Done():
				return fmt.Errorf("%s: %w (after %d retries, context cancelled)", label, ctx.Err(), attempt)
			}
		}

		err = fn()
		if err == nil {
			if attempt > 0 {
				logger.Printf("[retry] %s succeeded (attempt %d/%d)", label, attempt+1, cfg.MaxRetries+1)
			}
			return nil
		}

		if !isTransient(err) {
			return err
		}
	}
	return err
}

// isTransientGRPC returns true if the error represents a transient gRPC status
// code that is worth retrying.
//
// Note: Unauthenticated is included because the server's auth.go currently
// returns this code for transient DB errors (a bug). Remove Unauthenticated
// once issue-token-lookup-error-masking.md is fixed on the server side.
func isTransientGRPC(err error) bool {
	code := status.Code(err)
	switch code {
	case codes.Unavailable, // connection issues, load balancer errors
		codes.DeadlineExceeded, // timeout
		codes.Aborted,         // transaction conflict
		codes.Internal,        // server bug (includes masked DB errors)
		codes.ResourceExhausted, // rate limiting
		codes.Unauthenticated:   // masked DB errors from auth.go (server bug workaround)
		return true
	}
	return false
}
