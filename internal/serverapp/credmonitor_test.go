package serverapp

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/farmtable-io/farmtable/internal/store/ent/linkedaccount"
)

func TestCredentialMonitor_New(t *testing.T) {
	cm := NewCredentialMonitor(nil)
	if cm == nil {
		t.Fatal("expected non-nil CredentialMonitor")
	}
	if cm.interval != defaultMonitorInterval {
		t.Errorf("expected interval %v, got %v", defaultMonitorInterval, cm.interval)
	}
}

func TestCredentialMonitor_SetValidator(t *testing.T) {
	cm := NewCredentialMonitor(nil)

	called := false
	cm.SetValidator(linkedaccount.PlatformGithub, func(ctx context.Context, token string) error {
		called = true
		return nil
	})

	v := cm.validators[linkedaccount.PlatformGithub]
	if v == nil {
		t.Fatal("validator should be set")
	}

	err := v(context.Background(), "test-token")
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}
	if !called {
		t.Error("validator should have been called")
	}
}

func TestCredentialMonitor_ValidatorFailure(t *testing.T) {
	cm := NewCredentialMonitor(nil)

	cm.SetValidator(linkedaccount.PlatformGithub, func(ctx context.Context, token string) error {
		return fmt.Errorf("token revoked")
	})

	v := cm.validators[linkedaccount.PlatformGithub]
	err := v(context.Background(), "revoked-token")
	if err == nil {
		t.Error("expected error for revoked token")
	}
}

func TestCredentialMonitor_DefaultValidators(t *testing.T) {
	cm := NewCredentialMonitor(nil)

	platforms := []linkedaccount.Platform{
		linkedaccount.PlatformGithub,
		linkedaccount.PlatformJira,
		linkedaccount.PlatformLinear,
	}

	for _, p := range platforms {
		if _, ok := cm.validators[p]; !ok {
			t.Errorf("expected default validator for %s", p)
		}
	}

	// Asana and Beads should NOT have validators.
	if _, ok := cm.validators[linkedaccount.PlatformAsana]; ok {
		t.Error("asana should not have a default validator")
	}
	if _, ok := cm.validators[linkedaccount.PlatformBeads]; ok {
		t.Error("beads should not have a default validator")
	}
}

func TestCredentialMonitor_MonitorIntervalConstant(t *testing.T) {
	if defaultMonitorInterval != 1*time.Hour {
		t.Errorf("expected 1h monitor interval, got %v", defaultMonitorInterval)
	}
}
