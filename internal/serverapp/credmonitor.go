package serverapp

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/store/ent"
	"github.com/farmtable-io/farmtable/internal/store/ent/linkedaccount"
	"github.com/google/uuid"
)

const (
	// defaultMonitorInterval is how often the credential monitor checks
	// credential validity.
	defaultMonitorInterval = 1 * time.Hour
)

// PlatformValidator defines the function signature for per-platform
// credential validation. It takes an access token and returns nil if the
// credential is valid or an error if not.
type PlatformValidator func(ctx context.Context, token string) error

// CredentialMonitor runs in the background and periodically checks whether
// stored credentials are still valid by making lightweight API calls to
// each platform.
type CredentialMonitor struct {
	store      store.Store
	validators map[linkedaccount.Platform]PlatformValidator
	interval   time.Duration
	cancel     context.CancelFunc
}

// NewCredentialMonitor creates a new CredentialMonitor with default validators.
func NewCredentialMonitor(s store.Store) *CredentialMonitor {
	cm := &CredentialMonitor{
		store:      s,
		validators: make(map[linkedaccount.Platform]PlatformValidator),
		interval:   defaultMonitorInterval,
	}

	// Register default validators that make lightweight API calls.
	cm.validators[linkedaccount.PlatformGithub] = validateGitHubToken
	cm.validators[linkedaccount.PlatformJira] = validateJiraToken
	cm.validators[linkedaccount.PlatformLinear] = validateLinearToken

	return cm
}

// SetValidator overrides the validator for a given platform (useful for testing).
func (cm *CredentialMonitor) SetValidator(platform linkedaccount.Platform, v PlatformValidator) {
	cm.validators[platform] = v
}

// Start begins the background monitoring loop. Call Stop to shut down.
func (cm *CredentialMonitor) Start(ctx context.Context) {
	ctx, cm.cancel = context.WithCancel(ctx)
	go cm.run(ctx)
}

// Stop halts the background monitoring loop.
func (cm *CredentialMonitor) Stop() {
	if cm.cancel != nil {
		cm.cancel()
	}
}

func (cm *CredentialMonitor) run(ctx context.Context) {
	// Run once immediately, then on interval.
	cm.checkAll(ctx)

	ticker := time.NewTicker(cm.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			cm.checkAll(ctx)
		}
	}
}

// checkAll iterates through all active linked accounts and validates their
// credentials.
func (cm *CredentialMonitor) checkAll(ctx context.Context) {
	active := "active"
	accounts, _, err := cm.store.ListLinkedAccounts(ctx, store.ListLinkedAccountsParams{
		Status: &active,
	})
	if err != nil {
		log.Printf("[cred-monitor] listing accounts: %v", err)
		return
	}

	for _, acct := range accounts {
		if err := cm.checkAccount(ctx, acct); err != nil {
			log.Printf("[cred-monitor] account %s (%s): %v", acct.ID, acct.Platform, err)
		}
	}
}

// checkAccount validates a single linked account's credentials.
func (cm *CredentialMonitor) checkAccount(ctx context.Context, acct *ent.LinkedAccount) error {
	validator, ok := cm.validators[acct.Platform]
	if !ok {
		// No validator for this platform; skip silently.
		return nil
	}

	err := validator(ctx, acct.AuthToken)
	now := time.Now()

	if err != nil {
		log.Printf("[cred-monitor] credential invalid for account %s (%s): %v",
			acct.ID, acct.Platform, err)
		expired := "expired"
		if _, updateErr := cm.store.UpdateLinkedAccount(ctx, acct.ID, store.UpdateLinkedAccountParams{
			Status:          &expired,
			LastValidatedAt: &now,
		}); updateErr != nil {
			return fmt.Errorf("marking account expired: %w", updateErr)
		}
		return nil
	}

	// Credential is valid; update last_validated_at timestamp.
	if _, updateErr := cm.store.UpdateLinkedAccount(ctx, acct.ID, store.UpdateLinkedAccountParams{
		LastValidatedAt: &now,
	}); updateErr != nil {
		return fmt.Errorf("updating last_validated_at: %w", updateErr)
	}

	return nil
}

// CheckAccountNow performs an immediate credential check for a single account.
// Useful for on-demand validation.
func (cm *CredentialMonitor) CheckAccountNow(ctx context.Context, accountID string) error {
	id, err := uuid.Parse(accountID)
	if err != nil {
		return fmt.Errorf("invalid account ID: %w", err)
	}

	acct, err := cm.store.GetLinkedAccount(ctx, id)
	if err != nil {
		return fmt.Errorf("getting linked account: %w", err)
	}

	return cm.checkAccount(ctx, acct)
}

// ── Platform Validators ──
// Each validator makes a lightweight authenticated API call to verify the token
// is still valid. These are not exhaustive checks — just enough to detect
// revoked or expired tokens.

func validateGitHubToken(ctx context.Context, token string) error {
	req, err := http.NewRequestWithContext(ctx, "GET", "https://api.github.com/user", nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github+json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("GitHub API request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return fmt.Errorf("GitHub token invalid (HTTP %d)", resp.StatusCode)
	}
	if resp.StatusCode >= 400 {
		return fmt.Errorf("GitHub API error (HTTP %d)", resp.StatusCode)
	}
	return nil
}

func validateJiraToken(ctx context.Context, token string) error {
	req, err := http.NewRequestWithContext(ctx, "GET",
		"https://api.atlassian.com/oauth/token/accessible-resources", nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("Jira API request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return fmt.Errorf("Jira token invalid (HTTP %d)", resp.StatusCode)
	}
	if resp.StatusCode >= 400 {
		return fmt.Errorf("Jira API error (HTTP %d)", resp.StatusCode)
	}
	return nil
}

func validateLinearToken(ctx context.Context, token string) error {
	req, err := http.NewRequestWithContext(ctx, "GET", "https://api.linear.app/graphql", nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", token)
	req.Header.Set("Content-Type", "application/json")
	// Use a minimal query to check validity.
	req.Method = "POST"

	// We'll just check if auth headers are accepted. A full GraphQL query
	// would be more thorough but heavier. POST with no body returns a
	// parseable error vs an auth failure.
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("Linear API request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return fmt.Errorf("Linear token invalid (HTTP %d)", resp.StatusCode)
	}
	// Linear GraphQL endpoint may return 200 even on errors, but 401/403
	// definitively means the token is bad.
	return nil
}
