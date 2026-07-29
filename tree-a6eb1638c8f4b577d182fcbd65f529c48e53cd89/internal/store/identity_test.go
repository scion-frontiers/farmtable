package store_test

import (
	"context"
	"testing"
	"time"

	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/testutil"
	"github.com/google/uuid"
)

func TestCreateUser(t *testing.T) {
	s, cleanup := testutil.NewTestStore(t)
	defer cleanup()

	ctx := context.Background()
	email := "agent@example.com"
	u, err := s.CreateUser(ctx, store.CreateUserParams{
		DisplayName: "deploy-agent",
		Email:       &email,
		Type:        "agent",
		Status:      "active",
	})
	if err != nil {
		t.Fatalf("CreateUser: %v", err)
	}
	if u.DisplayName != "deploy-agent" {
		t.Errorf("DisplayName = %q, want %q", u.DisplayName, "deploy-agent")
	}
	if u.Email == nil || *u.Email != email {
		t.Errorf("Email = %v, want %q", u.Email, email)
	}
	if u.Type != "agent" {
		t.Errorf("Type = %q, want %q", u.Type, "agent")
	}
	if u.Status != "active" {
		t.Errorf("Status = %q, want %q", u.Status, "active")
	}
}

func TestGetUser(t *testing.T) {
	s, cleanup := testutil.NewTestStore(t)
	defer cleanup()

	ctx := context.Background()
	u, _ := s.CreateUser(ctx, store.CreateUserParams{
		DisplayName: "test-user",
		Type:        "human",
		Status:      "active",
	})

	got, err := s.GetUser(ctx, u.ID)
	if err != nil {
		t.Fatalf("GetUser: %v", err)
	}
	if got.ID != u.ID {
		t.Errorf("ID = %v, want %v", got.ID, u.ID)
	}
}

func TestGetUser_NotFound(t *testing.T) {
	s, cleanup := testutil.NewTestStore(t)
	defer cleanup()

	_, err := s.GetUser(context.Background(), uuid.New())
	if err != store.ErrNotFound {
		t.Errorf("err = %v, want ErrNotFound", err)
	}
}

func TestGetUserByName(t *testing.T) {
	s, cleanup := testutil.NewTestStore(t)
	defer cleanup()

	ctx := context.Background()
	created, _ := s.CreateUser(ctx, store.CreateUserParams{
		DisplayName: "find-me",
		Type:        "agent",
		Status:      "active",
	})

	got, err := s.GetUserByName(ctx, "find-me")
	if err != nil {
		t.Fatalf("GetUserByName: %v", err)
	}
	if got.ID != created.ID {
		t.Errorf("ID = %v, want %v", got.ID, created.ID)
	}
}

func TestListUsers(t *testing.T) {
	s, cleanup := testutil.NewTestStore(t)
	defer cleanup()

	ctx := context.Background()
	s.CreateUser(ctx, store.CreateUserParams{DisplayName: "a", Type: "agent", Status: "active"})
	s.CreateUser(ctx, store.CreateUserParams{DisplayName: "b", Type: "human", Status: "active"})

	users, total, err := s.ListUsers(ctx, store.ListUsersParams{})
	if err != nil {
		t.Fatalf("ListUsers: %v", err)
	}
	if total != 2 {
		t.Errorf("total = %d, want 2", total)
	}
	if len(users) != 2 {
		t.Errorf("len = %d, want 2", len(users))
	}

	agents, _, _ := s.ListUsers(ctx, store.ListUsersParams{Type: "agent"})
	if len(agents) != 1 {
		t.Errorf("agents len = %d, want 1", len(agents))
	}
}

func TestCreateAPIToken_HashRoundTrip(t *testing.T) {
	s, cleanup := testutil.NewTestStore(t)
	defer cleanup()

	ctx := context.Background()
	u, _ := s.CreateUser(ctx, store.CreateUserParams{
		DisplayName: "token-user",
		Type:        "agent",
		Status:      "active",
	})

	tok, rawToken, err := s.CreateAPIToken(ctx, store.CreateAPITokenParams{
		UserID: u.ID,
		Name:   "test-token",
	})
	if err != nil {
		t.Fatalf("CreateAPIToken: %v", err)
	}
	if rawToken == "" {
		t.Fatal("rawToken is empty")
	}
	if tok.Name != "test-token" {
		t.Errorf("Name = %q, want %q", tok.Name, "test-token")
	}

	hash := store.HashToken(rawToken)
	looked, err := s.LookupToken(ctx, hash)
	if err != nil {
		t.Fatalf("LookupToken: %v", err)
	}
	if looked.UserID != u.ID {
		t.Errorf("UserID = %v, want %v", looked.UserID, u.ID)
	}
	if looked.Edges.User == nil {
		t.Fatal("expected User edge to be loaded")
	}
	if looked.Edges.User.DisplayName != "token-user" {
		t.Errorf("User.DisplayName = %q, want %q", looked.Edges.User.DisplayName, "token-user")
	}
}

func TestLookupToken_NotFound(t *testing.T) {
	s, cleanup := testutil.NewTestStore(t)
	defer cleanup()

	_, err := s.LookupToken(context.Background(), "nonexistent-hash")
	if err != store.ErrNotFound {
		t.Errorf("err = %v, want ErrNotFound", err)
	}
}

func TestCreateAPIToken_WithExpiry(t *testing.T) {
	s, cleanup := testutil.NewTestStore(t)
	defer cleanup()

	ctx := context.Background()
	u, _ := s.CreateUser(ctx, store.CreateUserParams{
		DisplayName: "expiry-user",
		Type:        "agent",
		Status:      "active",
	})

	exp := time.Now().Add(24 * time.Hour)
	tok, _, err := s.CreateAPIToken(ctx, store.CreateAPITokenParams{
		UserID:    u.ID,
		Name:      "expiring-token",
		ExpiresAt: &exp,
	})
	if err != nil {
		t.Fatalf("CreateAPIToken: %v", err)
	}
	if tok.ExpiresAt == nil {
		t.Fatal("ExpiresAt should be set")
	}
}

func TestListAPITokens(t *testing.T) {
	s, cleanup := testutil.NewTestStore(t)
	defer cleanup()

	ctx := context.Background()
	u, _ := s.CreateUser(ctx, store.CreateUserParams{
		DisplayName: "list-user",
		Type:        "agent",
		Status:      "active",
	})

	s.CreateAPIToken(ctx, store.CreateAPITokenParams{UserID: u.ID, Name: "tok1"})
	s.CreateAPIToken(ctx, store.CreateAPITokenParams{UserID: u.ID, Name: "tok2"})

	tokens, total, err := s.ListAPITokens(ctx, store.ListAPITokensParams{})
	if err != nil {
		t.Fatalf("ListAPITokens: %v", err)
	}
	if total != 2 {
		t.Errorf("total = %d, want 2", total)
	}
	if len(tokens) != 2 {
		t.Errorf("len = %d, want 2", len(tokens))
	}
}

func TestRevokeAPIToken(t *testing.T) {
	s, cleanup := testutil.NewTestStore(t)
	defer cleanup()

	ctx := context.Background()
	u, _ := s.CreateUser(ctx, store.CreateUserParams{
		DisplayName: "revoke-user",
		Type:        "agent",
		Status:      "active",
	})

	tok, rawToken, _ := s.CreateAPIToken(ctx, store.CreateAPITokenParams{
		UserID: u.ID,
		Name:   "to-revoke",
	})

	if err := s.RevokeAPIToken(ctx, tok.ID); err != nil {
		t.Fatalf("RevokeAPIToken: %v", err)
	}

	hash := store.HashToken(rawToken)
	_, err := s.LookupToken(ctx, hash)
	if err != store.ErrNotFound {
		t.Errorf("err = %v, want ErrNotFound after revoke", err)
	}
}

func TestUpdateTokenLastUsed(t *testing.T) {
	s, cleanup := testutil.NewTestStore(t)
	defer cleanup()

	ctx := context.Background()
	u, _ := s.CreateUser(ctx, store.CreateUserParams{
		DisplayName: "usage-user",
		Type:        "agent",
		Status:      "active",
	})

	tok, _, _ := s.CreateAPIToken(ctx, store.CreateAPITokenParams{
		UserID: u.ID,
		Name:   "usage-tok",
	})

	if tok.LastUsedAt != nil {
		t.Fatal("LastUsedAt should be nil initially")
	}

	if err := s.UpdateTokenLastUsed(ctx, tok.ID); err != nil {
		t.Fatalf("UpdateTokenLastUsed: %v", err)
	}

	updated, _ := s.LookupToken(ctx, tok.TokenHash)
	if updated.LastUsedAt == nil {
		t.Fatal("LastUsedAt should be set after update")
	}
}
