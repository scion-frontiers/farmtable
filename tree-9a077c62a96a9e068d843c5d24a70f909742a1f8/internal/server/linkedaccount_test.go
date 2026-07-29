package server_test

import (
	"context"
	"testing"
	"time"

	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
	"github.com/farmtable-io/farmtable/internal/testutil"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"
)

func TestRPC_CreateLinkedAccount(t *testing.T) {
	client, cleanup := testutil.NewTestServer(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollection(t, client)

	t.Run("success", func(t *testing.T) {
		resp, err := client.CreateLinkedAccount(ctx, &pb.CreateLinkedAccountRequest{
			CollectionId: collID,
			Platform:     pb.Platform_PLATFORM_GITHUB,
			AuthMethod:   pb.AuthMethod_AUTH_METHOD_PAT,
			AuthToken:    "ghp_secret123",
			Scopes:       []string{"repo", "read:org"},
			RemoteUserId: strPtr("user-42"),
		})
		if err != nil {
			t.Fatalf("CreateLinkedAccount: %v", err)
		}
		la := resp.GetLinkedAccount()
		if la.GetId() == "" {
			t.Error("expected non-empty id")
		}
		if la.GetCollectionId() != collID {
			t.Errorf("collection_id = %q, want %q", la.GetCollectionId(), collID)
		}
		if la.GetPlatform() != pb.Platform_PLATFORM_GITHUB {
			t.Errorf("platform = %v, want GITHUB", la.GetPlatform())
		}
		if la.GetAuthMethod() != pb.AuthMethod_AUTH_METHOD_PAT {
			t.Errorf("auth_method = %v, want PAT", la.GetAuthMethod())
		}
		if la.GetRemoteUserId() != "user-42" {
			t.Errorf("remote_user_id = %q, want %q", la.GetRemoteUserId(), "user-42")
		}
		if la.GetStatus() != pb.LinkedAccountStatus_LINKED_ACCOUNT_STATUS_ACTIVE {
			t.Errorf("status = %v, want ACTIVE", la.GetStatus())
		}
		if len(la.GetScopes()) != 2 {
			t.Errorf("scopes = %v, want [repo read:org]", la.GetScopes())
		}
	})

	t.Run("auth_token_not_returned", func(t *testing.T) {
		resp, err := client.CreateLinkedAccount(ctx, &pb.CreateLinkedAccountRequest{
			CollectionId: collID,
			Platform:     pb.Platform_PLATFORM_GITHUB,
			AuthMethod:   pb.AuthMethod_AUTH_METHOD_PAT,
			AuthToken:    "ghp_supersecret",
		})
		if err != nil {
			t.Fatalf("CreateLinkedAccount: %v", err)
		}
		la := resp.GetLinkedAccount()
		// The proto LinkedAccount message does NOT have an auth_token field.
		// This test verifies the conversion omits it (the proto message has no such field).
		if la.GetId() == "" {
			t.Error("expected non-empty id")
		}
	})

	t.Run("with_expires_at", func(t *testing.T) {
		expiresAt := time.Now().Add(24 * time.Hour)
		resp, err := client.CreateLinkedAccount(ctx, &pb.CreateLinkedAccountRequest{
			CollectionId: collID,
			Platform:     pb.Platform_PLATFORM_LINEAR,
			AuthMethod:   pb.AuthMethod_AUTH_METHOD_OAUTH2_PKCE,
			AuthToken:    "lin_token_abc",
			ExpiresAt:    timestamppb.New(expiresAt),
		})
		if err != nil {
			t.Fatalf("CreateLinkedAccount: %v", err)
		}
		la := resp.GetLinkedAccount()
		if la.GetExpiresAt() == nil {
			t.Error("expected expires_at to be set")
		}
		if la.GetPlatform() != pb.Platform_PLATFORM_LINEAR {
			t.Errorf("platform = %v, want LINEAR", la.GetPlatform())
		}
	})

	t.Run("missing_platform", func(t *testing.T) {
		_, err := client.CreateLinkedAccount(ctx, &pb.CreateLinkedAccountRequest{
			CollectionId: collID,
			AuthMethod:   pb.AuthMethod_AUTH_METHOD_PAT,
			AuthToken:    "tok",
		})
		if err == nil {
			t.Fatal("expected error for missing platform")
		}
		if s, ok := status.FromError(err); !ok || s.Code() != codes.InvalidArgument {
			t.Errorf("code = %v, want InvalidArgument", status.Code(err))
		}
	})

	t.Run("missing_auth_method", func(t *testing.T) {
		_, err := client.CreateLinkedAccount(ctx, &pb.CreateLinkedAccountRequest{
			CollectionId: collID,
			Platform:     pb.Platform_PLATFORM_GITHUB,
			AuthToken:    "tok",
		})
		if err == nil {
			t.Fatal("expected error for missing auth_method")
		}
		if s, ok := status.FromError(err); !ok || s.Code() != codes.InvalidArgument {
			t.Errorf("code = %v, want InvalidArgument", status.Code(err))
		}
	})

	t.Run("missing_auth_token", func(t *testing.T) {
		_, err := client.CreateLinkedAccount(ctx, &pb.CreateLinkedAccountRequest{
			CollectionId: collID,
			Platform:     pb.Platform_PLATFORM_GITHUB,
			AuthMethod:   pb.AuthMethod_AUTH_METHOD_PAT,
		})
		if err == nil {
			t.Fatal("expected error for missing auth_token")
		}
		if s, ok := status.FromError(err); !ok || s.Code() != codes.InvalidArgument {
			t.Errorf("code = %v, want InvalidArgument", status.Code(err))
		}
	})

	t.Run("invalid_collection_id", func(t *testing.T) {
		_, err := client.CreateLinkedAccount(ctx, &pb.CreateLinkedAccountRequest{
			CollectionId: "not-a-uuid",
			Platform:     pb.Platform_PLATFORM_GITHUB,
			AuthMethod:   pb.AuthMethod_AUTH_METHOD_PAT,
			AuthToken:    "tok",
		})
		if err == nil {
			t.Fatal("expected error for invalid collection_id")
		}
		if s, ok := status.FromError(err); !ok || s.Code() != codes.InvalidArgument {
			t.Errorf("code = %v, want InvalidArgument", status.Code(err))
		}
	})
}

func TestRPC_GetLinkedAccount(t *testing.T) {
	client, cleanup := testutil.NewTestServer(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollection(t, client)

	t.Run("success", func(t *testing.T) {
		created, err := client.CreateLinkedAccount(ctx, &pb.CreateLinkedAccountRequest{
			CollectionId: collID,
			Platform:     pb.Platform_PLATFORM_GITHUB,
			AuthMethod:   pb.AuthMethod_AUTH_METHOD_PAT,
			AuthToken:    "ghp_test",
			Scopes:       []string{"repo"},
			RemoteUserId: strPtr("user-99"),
		})
		if err != nil {
			t.Fatalf("CreateLinkedAccount: %v", err)
		}

		resp, err := client.GetLinkedAccount(ctx, &pb.GetLinkedAccountRequest{
			Id: created.GetLinkedAccount().GetId(),
		})
		if err != nil {
			t.Fatalf("GetLinkedAccount: %v", err)
		}
		la := resp.GetLinkedAccount()
		if la.GetId() != created.GetLinkedAccount().GetId() {
			t.Errorf("id = %q, want %q", la.GetId(), created.GetLinkedAccount().GetId())
		}
		if la.GetPlatform() != pb.Platform_PLATFORM_GITHUB {
			t.Errorf("platform = %v, want GITHUB", la.GetPlatform())
		}
		if la.GetRemoteUserId() != "user-99" {
			t.Errorf("remote_user_id = %q, want %q", la.GetRemoteUserId(), "user-99")
		}
	})

	t.Run("not_found", func(t *testing.T) {
		_, err := client.GetLinkedAccount(ctx, &pb.GetLinkedAccountRequest{
			Id: "00000000-0000-0000-0000-000000000000",
		})
		if err == nil {
			t.Fatal("expected error for non-existent linked account")
		}
		if s, ok := status.FromError(err); !ok || s.Code() != codes.NotFound {
			t.Errorf("code = %v, want NotFound", status.Code(err))
		}
	})

	t.Run("invalid_id", func(t *testing.T) {
		_, err := client.GetLinkedAccount(ctx, &pb.GetLinkedAccountRequest{
			Id: "bad-id",
		})
		if err == nil {
			t.Fatal("expected error for invalid id")
		}
		if s, ok := status.FromError(err); !ok || s.Code() != codes.InvalidArgument {
			t.Errorf("code = %v, want InvalidArgument", status.Code(err))
		}
	})
}

func TestRPC_DeleteLinkedAccount(t *testing.T) {
	client, cleanup := testutil.NewTestServer(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollection(t, client)

	t.Run("success", func(t *testing.T) {
		created, err := client.CreateLinkedAccount(ctx, &pb.CreateLinkedAccountRequest{
			CollectionId: collID,
			Platform:     pb.Platform_PLATFORM_GITHUB,
			AuthMethod:   pb.AuthMethod_AUTH_METHOD_PAT,
			AuthToken:    "ghp_deleteme",
		})
		if err != nil {
			t.Fatalf("CreateLinkedAccount: %v", err)
		}
		laID := created.GetLinkedAccount().GetId()

		_, err = client.DeleteLinkedAccount(ctx, &pb.DeleteLinkedAccountRequest{Id: laID})
		if err != nil {
			t.Fatalf("DeleteLinkedAccount: %v", err)
		}

		// Verify it's gone
		_, err = client.GetLinkedAccount(ctx, &pb.GetLinkedAccountRequest{Id: laID})
		if err == nil {
			t.Fatal("expected NotFound after delete")
		}
		if s, ok := status.FromError(err); !ok || s.Code() != codes.NotFound {
			t.Errorf("code = %v, want NotFound", status.Code(err))
		}
	})

	t.Run("not_found", func(t *testing.T) {
		_, err := client.DeleteLinkedAccount(ctx, &pb.DeleteLinkedAccountRequest{
			Id: "00000000-0000-0000-0000-000000000000",
		})
		if err == nil {
			t.Fatal("expected error for non-existent linked account")
		}
		if s, ok := status.FromError(err); !ok || s.Code() != codes.NotFound {
			t.Errorf("code = %v, want NotFound", status.Code(err))
		}
	})

	t.Run("invalid_id", func(t *testing.T) {
		_, err := client.DeleteLinkedAccount(ctx, &pb.DeleteLinkedAccountRequest{
			Id: "bad-id",
		})
		if err == nil {
			t.Fatal("expected error for invalid id")
		}
		if s, ok := status.FromError(err); !ok || s.Code() != codes.InvalidArgument {
			t.Errorf("code = %v, want InvalidArgument", status.Code(err))
		}
	})
}

func TestRPC_ListLinkedAccounts(t *testing.T) {
	client, cleanup := testutil.NewTestServer(t)
	defer cleanup()
	ctx := context.Background()

	collID := createTestCollection(t, client)

	// Create a few linked accounts
	for _, p := range []pb.Platform{pb.Platform_PLATFORM_GITHUB, pb.Platform_PLATFORM_LINEAR, pb.Platform_PLATFORM_JIRA} {
		_, err := client.CreateLinkedAccount(ctx, &pb.CreateLinkedAccountRequest{
			CollectionId: collID,
			Platform:     p,
			AuthMethod:   pb.AuthMethod_AUTH_METHOD_PAT,
			AuthToken:    "tok-" + p.String(),
		})
		if err != nil {
			t.Fatalf("CreateLinkedAccount(%v): %v", p, err)
		}
	}

	t.Run("list_all", func(t *testing.T) {
		resp, err := client.ListLinkedAccounts(ctx, &pb.ListLinkedAccountsRequest{})
		if err != nil {
			t.Fatalf("ListLinkedAccounts: %v", err)
		}
		if len(resp.GetItems()) < 3 {
			t.Errorf("got %d items, want >= 3", len(resp.GetItems()))
		}
		if resp.GetTotalCount() < 3 {
			t.Errorf("total_count = %d, want >= 3", resp.GetTotalCount())
		}
	})

	t.Run("filter_by_collection", func(t *testing.T) {
		resp, err := client.ListLinkedAccounts(ctx, &pb.ListLinkedAccountsRequest{
			CollectionId: &collID,
		})
		if err != nil {
			t.Fatalf("ListLinkedAccounts: %v", err)
		}
		if len(resp.GetItems()) != 3 {
			t.Errorf("got %d items, want 3", len(resp.GetItems()))
		}
		for _, la := range resp.GetItems() {
			if la.GetCollectionId() != collID {
				t.Errorf("item collection_id = %q, want %q", la.GetCollectionId(), collID)
			}
		}
	})

	t.Run("filter_by_platform", func(t *testing.T) {
		plat := pb.Platform_PLATFORM_GITHUB
		resp, err := client.ListLinkedAccounts(ctx, &pb.ListLinkedAccountsRequest{
			CollectionId: &collID,
			Platform:     &plat,
		})
		if err != nil {
			t.Fatalf("ListLinkedAccounts: %v", err)
		}
		if len(resp.GetItems()) != 1 {
			t.Errorf("got %d items, want 1", len(resp.GetItems()))
		}
		if len(resp.GetItems()) > 0 && resp.GetItems()[0].GetPlatform() != pb.Platform_PLATFORM_GITHUB {
			t.Errorf("platform = %v, want GITHUB", resp.GetItems()[0].GetPlatform())
		}
	})

	t.Run("pagination", func(t *testing.T) {
		resp, err := client.ListLinkedAccounts(ctx, &pb.ListLinkedAccountsRequest{
			CollectionId: &collID,
			PageSize:     2,
		})
		if err != nil {
			t.Fatalf("ListLinkedAccounts (page 1): %v", err)
		}
		if len(resp.GetItems()) != 2 {
			t.Errorf("page 1 items = %d, want 2", len(resp.GetItems()))
		}
		if !resp.GetHasMore() {
			t.Error("expected has_more = true")
		}
		if resp.GetNextPageToken() == "" {
			t.Error("expected non-empty next_page_token")
		}

		// Get page 2
		resp2, err := client.ListLinkedAccounts(ctx, &pb.ListLinkedAccountsRequest{
			CollectionId: &collID,
			PageSize:     2,
			PageToken:    resp.GetNextPageToken(),
		})
		if err != nil {
			t.Fatalf("ListLinkedAccounts (page 2): %v", err)
		}
		if len(resp2.GetItems()) != 1 {
			t.Errorf("page 2 items = %d, want 1", len(resp2.GetItems()))
		}
	})

	t.Run("empty_collection", func(t *testing.T) {
		otherCollID := createTestCollection(t, client)
		resp, err := client.ListLinkedAccounts(ctx, &pb.ListLinkedAccountsRequest{
			CollectionId: &otherCollID,
		})
		if err != nil {
			t.Fatalf("ListLinkedAccounts: %v", err)
		}
		if len(resp.GetItems()) != 0 {
			t.Errorf("got %d items, want 0", len(resp.GetItems()))
		}
	})
}
