package store_test

import (
	"context"
	"testing"
	"time"

	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/store/ent/linkedaccount"
	"github.com/farmtable-io/farmtable/internal/testutil"
	"github.com/google/uuid"
)

func TestCreateAndGetLinkedAccount(t *testing.T) {
	s, cleanup := testutil.NewTestStore(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollection(t, s)

	created, err := s.CreateLinkedAccount(ctx, store.CreateLinkedAccountParams{
		CollectionID: collID,
		Platform:     "github",
		AuthToken:    "ghp_secret123",
		AuthMethod:   "pat",
		Scopes:       []string{"repo", "read:org"},
		RemoteUserID: "user-42",
	})
	if err != nil {
		t.Fatalf("CreateLinkedAccount: %v", err)
	}
	if created.CollectionID != collID {
		t.Errorf("collection_id = %v, want %v", created.CollectionID, collID)
	}
	if created.Platform != linkedaccount.PlatformGithub {
		t.Errorf("platform = %v, want %v", created.Platform, linkedaccount.PlatformGithub)
	}
	if created.AuthToken != "ghp_secret123" {
		t.Errorf("auth_token = %q, want %q", created.AuthToken, "ghp_secret123")
	}
	if created.AuthMethod != linkedaccount.AuthMethodPat {
		t.Errorf("auth_method = %v, want %v", created.AuthMethod, linkedaccount.AuthMethodPat)
	}
	if len(created.Scopes) != 2 || created.Scopes[0] != "repo" || created.Scopes[1] != "read:org" {
		t.Errorf("scopes = %v, want [repo read:org]", created.Scopes)
	}
	if created.RemoteUserID != "user-42" {
		t.Errorf("remote_user_id = %q, want %q", created.RemoteUserID, "user-42")
	}
	if created.Status != linkedaccount.StatusActive {
		t.Errorf("status = %v, want %v", created.Status, linkedaccount.StatusActive)
	}

	// Get by ID and verify all fields including sensitive auth_token.
	got, err := s.GetLinkedAccount(ctx, created.ID)
	if err != nil {
		t.Fatalf("GetLinkedAccount: %v", err)
	}
	if got.ID != created.ID {
		t.Errorf("ID = %v, want %v", got.ID, created.ID)
	}
	if got.AuthToken != "ghp_secret123" {
		t.Errorf("auth_token after get = %q, want %q", got.AuthToken, "ghp_secret123")
	}
	if got.Platform != linkedaccount.PlatformGithub {
		t.Errorf("platform after get = %v, want %v", got.Platform, linkedaccount.PlatformGithub)
	}
}

func TestCreateLinkedAccount_WithExpiresAt(t *testing.T) {
	s, cleanup := testutil.NewTestStore(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollection(t, s)
	expires := time.Date(2026, 12, 31, 23, 59, 59, 0, time.UTC)

	created, err := s.CreateLinkedAccount(ctx, store.CreateLinkedAccountParams{
		CollectionID: collID,
		Platform:     "linear",
		AuthToken:    "lin_token_abc",
		AuthMethod:   "oauth",
		ExpiresAt:    &expires,
	})
	if err != nil {
		t.Fatalf("CreateLinkedAccount: %v", err)
	}
	if created.ExpiresAt == nil {
		t.Fatal("expires_at should be set")
	}
	if !created.ExpiresAt.Equal(expires) {
		t.Errorf("expires_at = %v, want %v", *created.ExpiresAt, expires)
	}
}

func TestCreateLinkedAccount_MinimalFields(t *testing.T) {
	s, cleanup := testutil.NewTestStore(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollection(t, s)

	created, err := s.CreateLinkedAccount(ctx, store.CreateLinkedAccountParams{
		CollectionID: collID,
		Platform:     "jira",
		AuthToken:    "jira_secret",
		AuthMethod:   "pat",
	})
	if err != nil {
		t.Fatalf("CreateLinkedAccount: %v", err)
	}
	if created.ExpiresAt != nil {
		t.Errorf("expires_at should be nil, got %v", created.ExpiresAt)
	}
	if created.Status != linkedaccount.StatusActive {
		t.Errorf("status = %v, want active (default)", created.Status)
	}
}

func TestGetLinkedAccount_NotFound(t *testing.T) {
	s, cleanup := testutil.NewTestStore(t)
	defer cleanup()

	_, err := s.GetLinkedAccount(context.Background(), uuid.New())
	if err != store.ErrNotFound {
		t.Errorf("err = %v, want ErrNotFound", err)
	}
}

func TestDeleteLinkedAccount(t *testing.T) {
	s, cleanup := testutil.NewTestStore(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollection(t, s)
	created, err := s.CreateLinkedAccount(ctx, store.CreateLinkedAccountParams{
		CollectionID: collID,
		Platform:     "github",
		AuthToken:    "ghp_todelete",
		AuthMethod:   "pat",
	})
	if err != nil {
		t.Fatalf("CreateLinkedAccount: %v", err)
	}

	err = s.DeleteLinkedAccount(ctx, created.ID)
	if err != nil {
		t.Fatalf("DeleteLinkedAccount: %v", err)
	}

	// Verify it's gone.
	_, err = s.GetLinkedAccount(ctx, created.ID)
	if err != store.ErrNotFound {
		t.Errorf("after delete: err = %v, want ErrNotFound", err)
	}
}

func TestDeleteLinkedAccount_NotFound(t *testing.T) {
	s, cleanup := testutil.NewTestStore(t)
	defer cleanup()

	err := s.DeleteLinkedAccount(context.Background(), uuid.New())
	if err != store.ErrNotFound {
		t.Errorf("err = %v, want ErrNotFound", err)
	}
}

func TestListLinkedAccounts_NoFilter(t *testing.T) {
	s, cleanup := testutil.NewTestStore(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollection(t, s)
	for _, platform := range []string{"github", "linear"} {
		_, err := s.CreateLinkedAccount(ctx, store.CreateLinkedAccountParams{
			CollectionID: collID,
			Platform:     platform,
			AuthToken:    "tok_" + platform,
			AuthMethod:   "pat",
		})
		if err != nil {
			t.Fatalf("CreateLinkedAccount(%s): %v", platform, err)
		}
	}

	accounts, total, err := s.ListLinkedAccounts(ctx, store.ListLinkedAccountsParams{})
	if err != nil {
		t.Fatalf("ListLinkedAccounts: %v", err)
	}
	if total != 2 {
		t.Errorf("total = %d, want 2", total)
	}
	if len(accounts) != 2 {
		t.Errorf("len(accounts) = %d, want 2", len(accounts))
	}
}

func TestListLinkedAccounts_FilterByCollection(t *testing.T) {
	s, cleanup := testutil.NewTestStore(t)
	defer cleanup()
	ctx := context.Background()

	collID1 := createTestCollection(t, s)
	coll2, err := s.CreateCollection(ctx, store.CreateCollectionParams{Name: "other", Platform: "farmtable"})
	if err != nil {
		t.Fatalf("CreateCollection: %v", err)
	}
	collID2 := coll2.ID

	_, err = s.CreateLinkedAccount(ctx, store.CreateLinkedAccountParams{
		CollectionID: collID1,
		Platform:     "github",
		AuthToken:    "tok_1",
		AuthMethod:   "pat",
	})
	if err != nil {
		t.Fatalf("CreateLinkedAccount: %v", err)
	}
	_, err = s.CreateLinkedAccount(ctx, store.CreateLinkedAccountParams{
		CollectionID: collID2,
		Platform:     "linear",
		AuthToken:    "tok_2",
		AuthMethod:   "oauth",
	})
	if err != nil {
		t.Fatalf("CreateLinkedAccount: %v", err)
	}

	accounts, total, err := s.ListLinkedAccounts(ctx, store.ListLinkedAccountsParams{
		CollectionID: &collID1,
	})
	if err != nil {
		t.Fatalf("ListLinkedAccounts: %v", err)
	}
	if total != 1 {
		t.Errorf("total = %d, want 1", total)
	}
	if len(accounts) != 1 {
		t.Fatalf("len(accounts) = %d, want 1", len(accounts))
	}
	if accounts[0].CollectionID != collID1 {
		t.Errorf("collection_id = %v, want %v", accounts[0].CollectionID, collID1)
	}
}

func TestListLinkedAccounts_FilterByPlatform(t *testing.T) {
	s, cleanup := testutil.NewTestStore(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollection(t, s)
	for _, platform := range []string{"github", "github", "linear"} {
		_, err := s.CreateLinkedAccount(ctx, store.CreateLinkedAccountParams{
			CollectionID: collID,
			Platform:     platform,
			AuthToken:    "tok_" + platform + uuid.New().String()[:4],
			AuthMethod:   "pat",
		})
		if err != nil {
			t.Fatalf("CreateLinkedAccount: %v", err)
		}
	}

	platform := "github"
	accounts, total, err := s.ListLinkedAccounts(ctx, store.ListLinkedAccountsParams{
		Platform: &platform,
	})
	if err != nil {
		t.Fatalf("ListLinkedAccounts: %v", err)
	}
	if total != 2 {
		t.Errorf("total = %d, want 2", total)
	}
	if len(accounts) != 2 {
		t.Errorf("len(accounts) = %d, want 2", len(accounts))
	}
}

func TestListLinkedAccounts_FilterByStatus(t *testing.T) {
	s, cleanup := testutil.NewTestStore(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollection(t, s)

	// Create two accounts (both default to "active").
	_, err := s.CreateLinkedAccount(ctx, store.CreateLinkedAccountParams{
		CollectionID: collID,
		Platform:     "github",
		AuthToken:    "tok_active",
		AuthMethod:   "pat",
	})
	if err != nil {
		t.Fatalf("CreateLinkedAccount: %v", err)
	}
	_, err = s.CreateLinkedAccount(ctx, store.CreateLinkedAccountParams{
		CollectionID: collID,
		Platform:     "linear",
		AuthToken:    "tok_active2",
		AuthMethod:   "pat",
	})
	if err != nil {
		t.Fatalf("CreateLinkedAccount: %v", err)
	}

	status := "active"
	accounts, total, err := s.ListLinkedAccounts(ctx, store.ListLinkedAccountsParams{
		Status: &status,
	})
	if err != nil {
		t.Fatalf("ListLinkedAccounts: %v", err)
	}
	if total != 2 {
		t.Errorf("total = %d, want 2", total)
	}
	if len(accounts) != 2 {
		t.Errorf("len(accounts) = %d, want 2", len(accounts))
	}

	// Filter by a status that has no matches.
	expired := "expired"
	accounts, total, err = s.ListLinkedAccounts(ctx, store.ListLinkedAccountsParams{
		Status: &expired,
	})
	if err != nil {
		t.Fatalf("ListLinkedAccounts: %v", err)
	}
	if total != 0 {
		t.Errorf("total = %d, want 0", total)
	}
	if len(accounts) != 0 {
		t.Errorf("len(accounts) = %d, want 0", len(accounts))
	}
}

func TestListLinkedAccounts_Pagination(t *testing.T) {
	s, cleanup := testutil.NewTestStore(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollection(t, s)

	// Create 3 accounts.
	var ids []uuid.UUID
	for i := 0; i < 3; i++ {
		la, err := s.CreateLinkedAccount(ctx, store.CreateLinkedAccountParams{
			CollectionID: collID,
			Platform:     "github",
			AuthToken:    "tok_" + uuid.New().String()[:8],
			AuthMethod:   "pat",
		})
		if err != nil {
			t.Fatalf("CreateLinkedAccount %d: %v", i, err)
		}
		ids = append(ids, la.ID)
	}

	// Page 1: limit 2.
	page1, total, err := s.ListLinkedAccounts(ctx, store.ListLinkedAccountsParams{
		Limit: 2,
	})
	if err != nil {
		t.Fatalf("ListLinkedAccounts page1: %v", err)
	}
	if total != 3 {
		t.Errorf("total = %d, want 3", total)
	}
	if len(page1) != 2 {
		t.Fatalf("page1 len = %d, want 2", len(page1))
	}

	// Page 2: use last ID from page 1.
	page2, total2, err := s.ListLinkedAccounts(ctx, store.ListLinkedAccountsParams{
		Limit:  2,
		LastID: page1[len(page1)-1].ID.String(),
	})
	if err != nil {
		t.Fatalf("ListLinkedAccounts page2: %v", err)
	}
	if total2 != 3 {
		t.Errorf("total2 = %d, want 3", total2)
	}
	if len(page2) != 1 {
		t.Fatalf("page2 len = %d, want 1", len(page2))
	}

	// Ensure no overlap between pages.
	seen := make(map[uuid.UUID]bool)
	for _, la := range page1 {
		seen[la.ID] = true
	}
	for _, la := range page2 {
		if seen[la.ID] {
			t.Errorf("duplicate ID %v across pages", la.ID)
		}
	}
}

func TestListLinkedAccounts_AuthTokenRetrievable(t *testing.T) {
	s, cleanup := testutil.NewTestStore(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollection(t, s)
	secret := "ghp_supersecrettoken123"

	_, err := s.CreateLinkedAccount(ctx, store.CreateLinkedAccountParams{
		CollectionID: collID,
		Platform:     "github",
		AuthToken:    secret,
		AuthMethod:   "pat",
	})
	if err != nil {
		t.Fatalf("CreateLinkedAccount: %v", err)
	}

	accounts, _, err := s.ListLinkedAccounts(ctx, store.ListLinkedAccountsParams{
		CollectionID: &collID,
	})
	if err != nil {
		t.Fatalf("ListLinkedAccounts: %v", err)
	}
	if len(accounts) != 1 {
		t.Fatalf("expected 1 account, got %d", len(accounts))
	}
	if accounts[0].AuthToken != secret {
		t.Errorf("auth_token = %q, want %q", accounts[0].AuthToken, secret)
	}
}
