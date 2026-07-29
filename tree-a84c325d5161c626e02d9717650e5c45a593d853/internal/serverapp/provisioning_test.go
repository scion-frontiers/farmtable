package serverapp

import (
	"context"
	"fmt"
	"testing"

	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/store/ent"
	"github.com/google/uuid"
)

// mockProvisioningStore implements the subset of store.Store that
// UserProvisioner needs.
type mockProvisioningStore struct {
	store.Store // embed to satisfy interface; panics on unimplemented methods
	users       []*ent.User
	created     []*ent.User
}

func (m *mockProvisioningStore) GetUserByEmail(_ context.Context, email string) ([]*ent.User, error) {
	var result []*ent.User
	for _, u := range m.users {
		if u.Email != nil && *u.Email == email {
			result = append(result, u)
		}
	}
	return result, nil
}

func (m *mockProvisioningStore) CreateUser(_ context.Context, p store.CreateUserParams) (*ent.User, error) {
	u := &ent.User{
		ID:          uuid.New(),
		DisplayName: p.DisplayName,
		Email:       p.Email,
		Type:        p.Type,
		Status:      p.Status,
	}
	m.users = append(m.users, u)
	m.created = append(m.created, u)
	return u, nil
}

func (m *mockProvisioningStore) GetUser(_ context.Context, id uuid.UUID) (*ent.User, error) {
	for _, u := range m.users {
		if u.ID == id {
			return u, nil
		}
	}
	return nil, fmt.Errorf("not found")
}

func strPtr(s string) *string { return &s }

func TestUserProvisioner_FindExistingUser(t *testing.T) {
	existing := &ent.User{
		ID:          uuid.New(),
		DisplayName: "Alice",
		Email:       strPtr("alice@example.com"),
		Type:        "human",
		Status:      "active",
	}
	s := &mockProvisioningStore{users: []*ent.User{existing}}
	p := NewUserProvisioner(s, "")

	result, err := p.FindOrCreateByEmail(context.Background(), "alice@example.com", "Alice")
	if err != nil {
		t.Fatalf("FindOrCreateByEmail: %v", err)
	}
	if result.Created {
		t.Error("expected Created=false for existing user")
	}
	if result.User.ID != existing.ID {
		t.Errorf("user ID = %s, want %s", result.User.ID, existing.ID)
	}
}

func TestUserProvisioner_CreateNewUser(t *testing.T) {
	s := &mockProvisioningStore{}
	p := NewUserProvisioner(s, "")

	result, err := p.FindOrCreateByEmail(context.Background(), "bob@example.com", "Bob")
	if err != nil {
		t.Fatalf("FindOrCreateByEmail: %v", err)
	}
	if !result.Created {
		t.Error("expected Created=true for new user")
	}
	if result.User.DisplayName != "Bob" {
		t.Errorf("display name = %q, want %q", result.User.DisplayName, "Bob")
	}
	if result.User.Email == nil || *result.User.Email != "bob@example.com" {
		t.Errorf("email = %v, want %q", result.User.Email, "bob@example.com")
	}
	if result.User.Type != "human" {
		t.Errorf("type = %q, want %q", result.User.Type, "human")
	}
	if result.User.Status != "active" {
		t.Errorf("status = %q, want %q", result.User.Status, "active")
	}
}

func TestUserProvisioner_CreateNewUser_DeriveDisplayName(t *testing.T) {
	s := &mockProvisioningStore{}
	p := NewUserProvisioner(s, "")

	result, err := p.FindOrCreateByEmail(context.Background(), "charlie@example.com", "")
	if err != nil {
		t.Fatalf("FindOrCreateByEmail: %v", err)
	}
	if result.User.DisplayName != "charlie" {
		t.Errorf("display name = %q, want %q (derived from email)", result.User.DisplayName, "charlie")
	}
}

func TestUserProvisioner_CaseInsensitiveEmail(t *testing.T) {
	existing := &ent.User{
		ID:          uuid.New(),
		DisplayName: "Alice",
		Email:       strPtr("alice@example.com"),
		Type:        "human",
		Status:      "active",
	}
	s := &mockProvisioningStore{users: []*ent.User{existing}}
	p := NewUserProvisioner(s, "")

	result, err := p.FindOrCreateByEmail(context.Background(), "Alice@Example.COM", "Alice")
	if err != nil {
		t.Fatalf("FindOrCreateByEmail: %v", err)
	}
	if result.Created {
		t.Error("expected case-insensitive match to find existing user")
	}
}

func TestUserProvisioner_PrefersActiveUser(t *testing.T) {
	suspended := &ent.User{
		ID:          uuid.New(),
		DisplayName: "Alice (suspended)",
		Email:       strPtr("alice@example.com"),
		Type:        "human",
		Status:      "suspended",
	}
	active := &ent.User{
		ID:          uuid.New(),
		DisplayName: "Alice",
		Email:       strPtr("alice@example.com"),
		Type:        "human",
		Status:      "active",
	}
	s := &mockProvisioningStore{users: []*ent.User{suspended, active}}
	p := NewUserProvisioner(s, "")

	result, err := p.FindOrCreateByEmail(context.Background(), "alice@example.com", "")
	if err != nil {
		t.Fatalf("FindOrCreateByEmail: %v", err)
	}
	if result.User.ID != active.ID {
		t.Errorf("expected active user to be preferred, got %s", result.User.ID)
	}
}

func TestUserProvisioner_DomainAllowlist_Allowed(t *testing.T) {
	s := &mockProvisioningStore{}
	p := NewUserProvisioner(s, "example.com,corp.dev")

	result, err := p.FindOrCreateByEmail(context.Background(), "bob@example.com", "Bob")
	if err != nil {
		t.Fatalf("FindOrCreateByEmail: %v", err)
	}
	if !result.Created {
		t.Error("expected user to be created for allowed domain")
	}
}

func TestUserProvisioner_DomainAllowlist_Blocked(t *testing.T) {
	s := &mockProvisioningStore{}
	p := NewUserProvisioner(s, "example.com,corp.dev")

	_, err := p.FindOrCreateByEmail(context.Background(), "bob@notallowed.com", "Bob")
	if err == nil {
		t.Fatal("expected error for blocked domain")
	}
	domErr, ok := err.(*ErrDomainNotAllowed)
	if !ok {
		t.Fatalf("expected *ErrDomainNotAllowed, got %T: %v", err, err)
	}
	if domErr.Email != "bob@notallowed.com" {
		t.Errorf("email = %q, want %q", domErr.Email, "bob@notallowed.com")
	}
}

func TestUserProvisioner_DomainAllowlist_Empty(t *testing.T) {
	s := &mockProvisioningStore{}
	p := NewUserProvisioner(s, "")

	// Empty allowlist means all domains are allowed.
	result, err := p.FindOrCreateByEmail(context.Background(), "bob@anydomain.org", "Bob")
	if err != nil {
		t.Fatalf("FindOrCreateByEmail: %v", err)
	}
	if !result.Created {
		t.Error("expected user to be created when no domain restriction")
	}
}

func TestUserProvisioner_EmptyEmail(t *testing.T) {
	s := &mockProvisioningStore{}
	p := NewUserProvisioner(s, "")

	_, err := p.FindOrCreateByEmail(context.Background(), "", "Bob")
	if err == nil {
		t.Fatal("expected error for empty email")
	}
}

func TestNewUserProvisioner_ParsesDomains(t *testing.T) {
	tests := []struct {
		input string
		want  []string
	}{
		{"", nil},
		{"example.com", []string{"example.com"}},
		{"example.com,corp.dev", []string{"example.com", "corp.dev"}},
		{" example.com , corp.dev ", []string{"example.com", "corp.dev"}},
		{"Example.COM", []string{"example.com"}},
		{",,,", nil}, // only commas = empty
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			s := &mockProvisioningStore{}
			p := NewUserProvisioner(s, tt.input)
			if len(p.AllowedDomains) != len(tt.want) {
				t.Fatalf("AllowedDomains = %v, want %v", p.AllowedDomains, tt.want)
			}
			for i, d := range p.AllowedDomains {
				if d != tt.want[i] {
					t.Errorf("AllowedDomains[%d] = %q, want %q", i, d, tt.want[i])
				}
			}
		})
	}
}
