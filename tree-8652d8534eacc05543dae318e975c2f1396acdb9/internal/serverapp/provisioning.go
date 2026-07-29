package serverapp

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/farmtable-io/farmtable/internal/server"
	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/store/ent"
	"github.com/google/uuid"
)

// UserProvisioner handles find-or-create semantics for users authenticated
// via OAuth or IAP proxy. When a user logs in for the first time, a new User
// record is created. On subsequent logins, the existing user is returned.
type UserProvisioner struct {
	store store.Store

	// AllowedDomains restricts which email domains can be provisioned.
	// If empty, all domains are allowed.
	AllowedDomains []string
}

// NewUserProvisioner creates a UserProvisioner.
// allowedDomains is a comma-separated list of domains (e.g. "example.com,corp.dev").
// An empty string allows all domains.
func NewUserProvisioner(s store.Store, allowedDomains string) *UserProvisioner {
	var domains []string
	for _, d := range strings.Split(allowedDomains, ",") {
		d = strings.ToLower(strings.TrimSpace(d))
		if d != "" {
			domains = append(domains, d)
		}
	}
	return &UserProvisioner{
		store:          s,
		AllowedDomains: domains,
	}
}

// ProvisionResult holds the result of a find-or-create operation.
type ProvisionResult struct {
	User    *ent.User
	Created bool
}

// FindOrCreateByEmail looks up a user by email. If no user exists, one is
// created with the given display name. Returns ErrDomainNotAllowed if the
// email domain is not in the allowlist (when one is configured).
func (p *UserProvisioner) FindOrCreateByEmail(ctx context.Context, email, displayName string) (*ProvisionResult, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	if email == "" {
		return nil, fmt.Errorf("email is required for user provisioning")
	}

	// Domain check.
	if err := p.checkDomain(email); err != nil {
		return nil, err
	}

	// Try to find existing user by email.
	users, err := p.store.GetUserByEmail(ctx, email)
	if err != nil {
		return nil, fmt.Errorf("looking up user by email: %w", err)
	}

	// Return the first active user, or the first user if none are active.
	for _, u := range users {
		if u.Status == "active" {
			return &ProvisionResult{User: u, Created: false}, nil
		}
	}
	if len(users) > 0 {
		return &ProvisionResult{User: users[0], Created: false}, nil
	}

	// No existing user — create one.
	if displayName == "" {
		// Derive display name from email prefix.
		displayName = email
		if idx := strings.Index(email, "@"); idx > 0 {
			displayName = email[:idx]
		}
	}

	u, err := p.store.CreateUser(ctx, store.CreateUserParams{
		DisplayName: displayName,
		Email:       &email,
		Type:        "human",
		Status:      "active",
	})
	if err != nil {
		return nil, fmt.Errorf("creating user: %w", err)
	}

	log.Printf("provisioned new user %s (%s) via OAuth/proxy", u.ID, email)
	return &ProvisionResult{User: u, Created: true}, nil
}

// ErrDomainNotAllowed is returned when a user's email domain is not
// in the configured allowlist.
type ErrDomainNotAllowed struct {
	Email   string
	Domains []string
}

func (e *ErrDomainNotAllowed) Error() string {
	return fmt.Sprintf("email domain not allowed: %s (allowed: %s)", e.Email, strings.Join(e.Domains, ", "))
}

// checkDomain validates the email domain against the allowlist.
func (p *UserProvisioner) checkDomain(email string) error {
	if len(p.AllowedDomains) == 0 {
		return nil // all domains allowed
	}

	parts := strings.SplitN(email, "@", 2)
	if len(parts) != 2 {
		return fmt.Errorf("invalid email address: %s", email)
	}
	domain := strings.ToLower(parts[1])

	for _, allowed := range p.AllowedDomains {
		if domain == allowed {
			return nil
		}
	}

	return &ErrDomainNotAllowed{Email: email, Domains: p.AllowedDomains}
}

// CreateSessionToken creates a short-lived API token for an OAuth/IAP-provisioned
// user. The token bridges the session to the gRPC auth interceptor via the
// session-to-bearer middleware. It expires in 24 hours (matching session lifetime)
// and receives default scopes for the user's type.
func (p *UserProvisioner) CreateSessionToken(ctx context.Context, userID uuid.UUID, userType string) (string, error) {
	expires := time.Now().Add(24 * time.Hour)
	scopes := server.DefaultScopesForUserType(userType)

	_, rawToken, err := p.store.CreateAPIToken(ctx, store.CreateAPITokenParams{
		UserID:    userID,
		Name:      "session-auth",
		ExpiresAt: &expires,
		Scopes:    scopes,
	})
	if err != nil {
		return "", fmt.Errorf("creating session token: %w", err)
	}
	return rawToken, nil
}

// LookupUserByID is a convenience wrapper around the store's GetUser.
func (p *UserProvisioner) LookupUserByID(ctx context.Context, id uuid.UUID) (*ent.User, error) {
	return p.store.GetUser(ctx, id)
}
