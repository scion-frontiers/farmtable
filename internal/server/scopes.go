package server

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// Scope constants define the RBAC permission vocabulary.
const (
	ScopeWildcard       = "*"
	ScopeTaskRead       = "task:read"
	ScopeTaskWrite      = "task:write"
	ScopeTaskClaim      = "task:claim"
	ScopeCollectionRead  = "collection:read"
	ScopeCollectionWrite = "collection:write"
	ScopeCollectionAdmin = "collection:admin"
	ScopeTokenManage     = "token:manage"
	ScopeUserRead        = "user:read"
)

// AllScopes lists every valid scope string (excluding wildcard).
var AllScopes = []string{
	ScopeTaskRead,
	ScopeTaskWrite,
	ScopeTaskClaim,
	ScopeCollectionRead,
	ScopeCollectionWrite,
	ScopeCollectionAdmin,
	ScopeTokenManage,
	ScopeUserRead,
}

// Context keys for scope data injected by the auth interceptor.
const scopesKey contextKey = "token_scopes"
const collectionIDsKey contextKey = "token_collection_ids"

// ContextWithScopes stores the token scopes in the context.
func ContextWithScopes(ctx context.Context, scopes []string) context.Context {
	return context.WithValue(ctx, scopesKey, scopes)
}

// ScopesFromContext retrieves the token scopes from the context.
// Returns nil if no scopes are set (wildcard/legacy token).
func ScopesFromContext(ctx context.Context) []string {
	scopes, _ := ctx.Value(scopesKey).([]string)
	return scopes
}

// ContextWithCollectionIDs stores the token collection restrictions in the context.
func ContextWithCollectionIDs(ctx context.Context, ids []uuid.UUID) context.Context {
	return context.WithValue(ctx, collectionIDsKey, ids)
}

// CollectionIDsFromContext retrieves the collection restrictions from the context.
// Returns nil if the token is not restricted to specific collections.
func CollectionIDsFromContext(ctx context.Context) []uuid.UUID {
	ids, _ := ctx.Value(collectionIDsKey).([]uuid.UUID)
	return ids
}

// RequireScope checks whether the authenticated token has the given scope.
// Nil scopes (legacy tokens / no scopes set) are treated as wildcard and
// pass all checks. The wildcard scope "*" also passes all checks.
// Returns codes.PermissionDenied if the scope is missing.
func RequireScope(ctx context.Context, scope string) error {
	// If auth is not enforced (open-access mode), allow everything.
	if ctx.Value(authEnforcedKey) == nil {
		return nil
	}

	scopes := ScopesFromContext(ctx)

	// nil/empty scopes = wildcard (backward compatible with existing tokens)
	if len(scopes) == 0 {
		return nil
	}

	for _, s := range scopes {
		if s == ScopeWildcard || s == scope {
			return nil
		}
	}

	return status.Errorf(codes.PermissionDenied, "missing required scope %q", scope)
}

// RequireCollectionAccess checks whether the token is authorized to access
// the given collection. If the token has no collection restrictions (nil/empty
// CollectionIDs), access is allowed to all collections. Otherwise the target
// collection must appear in the allowed list.
func RequireCollectionAccess(ctx context.Context, collectionID uuid.UUID) error {
	// If auth is not enforced (open-access mode), allow everything.
	if ctx.Value(authEnforcedKey) == nil {
		return nil
	}

	allowed := CollectionIDsFromContext(ctx)
	if len(allowed) == 0 {
		return nil // no collection restrictions
	}

	for _, id := range allowed {
		if id == collectionID {
			return nil
		}
	}

	return status.Errorf(codes.PermissionDenied, "token not authorized for collection %s", collectionID)
}

// DefaultScopesForUserType returns the default scopes for a given user type
// when creating a token without explicit scopes.
func DefaultScopesForUserType(userType string) []string {
	switch userType {
	case "admin":
		return []string{ScopeWildcard}
	case "agent":
		return []string{ScopeTaskRead, ScopeTaskWrite, ScopeTaskClaim, ScopeCollectionRead}
	case "viewer":
		return []string{ScopeTaskRead, ScopeCollectionRead}
	case "human":
		return []string{ScopeWildcard}
	case "service_account":
		return []string{ScopeWildcard}
	default:
		return nil // nil = wildcard (backward compatible)
	}
}

// ValidateScopes checks that all provided scope strings are recognized.
func ValidateScopes(scopes []string) error {
	valid := make(map[string]bool, len(AllScopes)+1)
	valid[ScopeWildcard] = true
	for _, s := range AllScopes {
		valid[s] = true
	}
	for _, s := range scopes {
		if !valid[s] {
			return fmt.Errorf("unknown scope %q", s)
		}
	}
	return nil
}
