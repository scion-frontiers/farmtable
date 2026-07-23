package serverapp

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/store/ent"
	"github.com/farmtable-io/farmtable/internal/store/ent/linkedaccount"
	"golang.org/x/oauth2"
)

const (
	// defaultRefreshInterval is how often the token refresher scans for
	// expiring tokens.
	defaultRefreshInterval = 30 * time.Minute

	// refreshWindow is how far ahead of expiry we start refreshing.
	// Tokens that expire within this window will be refreshed proactively.
	refreshWindow = 15 * time.Minute
)

// PlatformRefreshConfigs holds per-platform OAuth2 configs used for token
// refresh. Platforms that don't use refresh tokens (e.g. PAT-based) are nil.
type PlatformRefreshConfigs struct {
	GitHub *oauth2.Config
	Jira   *oauth2.Config
	Linear *oauth2.Config
}

// TokenRefresher runs in the background and refreshes OAuth access tokens
// before they expire.
type TokenRefresher struct {
	store    store.Store
	configs  PlatformRefreshConfigs
	interval time.Duration
	cancel   context.CancelFunc
}

// NewTokenRefresher creates a new TokenRefresher.
func NewTokenRefresher(s store.Store, configs PlatformRefreshConfigs) *TokenRefresher {
	return &TokenRefresher{
		store:    s,
		configs:  configs,
		interval: defaultRefreshInterval,
	}
}

// Start begins the background refresh loop. Call Stop to shut down.
func (tr *TokenRefresher) Start(ctx context.Context) {
	ctx, tr.cancel = context.WithCancel(ctx)
	go tr.run(ctx)
}

// Stop halts the background refresh loop.
func (tr *TokenRefresher) Stop() {
	if tr.cancel != nil {
		tr.cancel()
	}
}

func (tr *TokenRefresher) run(ctx context.Context) {
	// Run once immediately, then on interval.
	tr.refreshAll(ctx)

	ticker := time.NewTicker(tr.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			tr.refreshAll(ctx)
		}
	}
}

// refreshAll scans all active OAuth-linked accounts and refreshes tokens
// that are near expiry.
func (tr *TokenRefresher) refreshAll(ctx context.Context) {
	active := "active"
	accounts, _, err := tr.store.ListLinkedAccounts(ctx, store.ListLinkedAccountsParams{
		Status: &active,
	})
	if err != nil {
		log.Printf("[token-refresh] listing accounts: %v", err)
		return
	}

	now := time.Now()
	for _, acct := range accounts {
		// Skip non-OAuth accounts (PATs don't have refresh tokens).
		if acct.AuthMethod != linkedaccount.AuthMethodOauth {
			continue
		}

		// Skip accounts without a token expiry or refresh token.
		if acct.TokenExpiry == nil || acct.RefreshToken == "" {
			continue
		}

		// Check if the token will expire within the refresh window.
		if acct.TokenExpiry.After(now.Add(refreshWindow)) {
			continue
		}

		if err := tr.refreshAccount(ctx, acct); err != nil {
			log.Printf("[token-refresh] refreshing account %s (%s): %v",
				acct.ID, acct.Platform, err)
			// Mark the account as expired if refresh fails.
			expired := "expired"
			if _, updateErr := tr.store.UpdateLinkedAccount(ctx, acct.ID, store.UpdateLinkedAccountParams{
				Status: &expired,
			}); updateErr != nil {
				log.Printf("[token-refresh] marking account %s expired: %v", acct.ID, updateErr)
			}
		}
	}
}

// refreshAccount performs the token refresh for a single linked account.
func (tr *TokenRefresher) refreshAccount(ctx context.Context, acct *ent.LinkedAccount) error {
	cfg := tr.configForPlatform(acct.Platform)
	if cfg == nil {
		return fmt.Errorf("no OAuth config for platform %s", acct.Platform)
	}

	// Use the refresh token to get a new access token.
	tokenSource := cfg.TokenSource(ctx, &oauth2.Token{
		RefreshToken: acct.RefreshToken,
	})

	newToken, err := tokenSource.Token()
	if err != nil {
		return fmt.Errorf("refreshing token: %w", err)
	}

	// Update the linked account with the new token.
	params := store.UpdateLinkedAccountParams{
		AuthToken: &newToken.AccessToken,
	}
	if newToken.RefreshToken != "" && newToken.RefreshToken != acct.RefreshToken {
		params.RefreshToken = &newToken.RefreshToken
	}
	if !newToken.Expiry.IsZero() {
		params.TokenExpiry = &newToken.Expiry
	}

	if _, err := tr.store.UpdateLinkedAccount(ctx, acct.ID, params); err != nil {
		return fmt.Errorf("updating account: %w", err)
	}

	log.Printf("[token-refresh] refreshed token for account %s (%s), new expiry: %s",
		acct.ID, acct.Platform, newToken.Expiry.Format(time.RFC3339))
	return nil
}

func (tr *TokenRefresher) configForPlatform(platform linkedaccount.Platform) *oauth2.Config {
	switch platform {
	case linkedaccount.PlatformGithub:
		return tr.configs.GitHub
	case linkedaccount.PlatformJira:
		return tr.configs.Jira
	case linkedaccount.PlatformLinear:
		return tr.configs.Linear
	default:
		return nil
	}
}

