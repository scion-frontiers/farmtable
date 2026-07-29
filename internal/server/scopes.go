package server

import (
	"context"
	"fmt"
	"log"

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
	ScopeTaskAccept     = "task:accept"
	ScopeTaskClose      = "task:close"
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
	ScopeTaskAccept,
	ScopeTaskClose,
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

// ScopesFromContext retrieves the token scopes held by the authenticated
// principal. An empty result means the principal HOLDS NO SCOPES, which grants
// nothing. It has never meant "unrestricted" and must not be read that way; see
// RequireScope for the sense analysis.
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

// RequireScope checks whether the authenticated token holds the given scope.
// The wildcard scope "*" passes all checks. Returns codes.PermissionDenied if
// the scope is missing.
//
// An empty scope set means the principal HOLDS NO SCOPES and is therefore
// denied everything. It does NOT mean "this endpoint requires no scopes": that
// sense is expressed by not calling RequireScope at all, and — for RPCs exempt
// from authentication entirely — by isUnauthenticatedEndpoint in auth.go, a
// switch over method names. The `scope` parameter here is a single non-empty
// string, never a list, so the two senses share no representation and denying
// on empty cannot affect an endpoint that legitimately requires nothing.
//
// This is the single point at which a held scope set is read for an
// authorization decision. scopesKey is an unexported constant of the unexported
// type contextKey, so no package outside internal/server can install a scope
// set, and ScopesFromContext is the only reader of it. The invariant "an empty
// or unrecognised permission set is never permission for everything" is
// therefore established here for every caller, present and future, rather than
// at each site that can produce an empty set.
func RequireScope(ctx context.Context, scope string) error {
	// If auth is not enforced (open-access mode), allow everything.
	if ctx.Value(authEnforcedKey) == nil {
		return nil
	}

	scopes := ScopesFromContext(ctx)

	// An empty scope set grants nothing. A live token reaches this state when
	// it was minted for a user type the scope table does not recognise, or
	// before the scope vocabulary existed. Both are bugs in the account, so the
	// denial is logged loudly: a silent denial would replace an invisible
	// privilege escalation with an invisible outage.
	if len(scopes) == 0 {
		logEmptyScopeSetDenial(ctx, scope)
		return status.Errorf(codes.PermissionDenied,
			"token holds no scopes; %q denied. An empty scope set grants nothing. "+
				"Check the account's user type and re-issue the token with explicit scopes",
			scope)
	}

	for _, s := range scopes {
		if s == ScopeWildcard || s == scope {
			return nil
		}
	}

	return status.Errorf(codes.PermissionDenied, "missing required scope %q", scope)
}

// logEmptyScopeSetDenial reports an empty-scope-set denial in a form an
// operator can act on: the account that was blocked, and the scope it was
// blocked on. The offending user type is not carried in the request context, so
// the message names the command that reveals it.
func logEmptyScopeSetDenial(ctx context.Context, scope string) {
	userID := "<unknown>"
	if id, ok := UserIDFromContext(ctx); ok {
		userID = id.String()
	}
	log.Printf("SECURITY: empty scope set denied — user=%s required_scope=%q. "+
		"This token grants nothing. Inspect the account's user type with "+
		"`ft user get %s`, then re-issue the token with explicit scopes.",
		userID, scope, userID)
}

// RequireCollectionAccess checks whether the token is authorized to access
// the given collection. If the token has no collection restrictions (nil/empty
// CollectionIDs), access is allowed to all collections. Otherwise the target
// collection must appear in the allowed list.
//
// Deliberately NOT symmetric with RequireScope. CollectionIDs is a RESTRICTION
// list, where empty correctly means "unrestricted"; scopes are a GRANT list,
// where empty correctly means "nothing". The two look alike and mean opposite
// things, so do not "fix" this one by analogy with the other. Nothing derives
// CollectionIDs from the user type, so an unrecognised type cannot reach a
// wildcard through this function.
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
		// Agents may work tasks but cannot accept them out of triage or close them.
		return []string{ScopeTaskRead, ScopeTaskWrite, ScopeTaskClaim, ScopeCollectionRead}
	case "reviewer", "orchestrator":
		// Reviewers and orchestrators own the full task lifecycle.
		return []string{
			ScopeTaskRead,
			ScopeTaskWrite,
			ScopeTaskClaim,
			ScopeTaskAccept,
			ScopeTaskClose,
			ScopeCollectionRead,
		}
	case "viewer":
		return []string{ScopeTaskRead, ScopeCollectionRead}
	case "human":
		return []string{ScopeWildcard}
	case "service_account":
		return []string{ScopeWildcard}
	default:
		// Unrecognized user types get wildcard for backward compatibility with
		// tokens issued before the type vocabulary was formalized. Log a warning
		// so operator typos like "reviewr" that would silently grant full admin
		// instead of the intended restricted scope set are visible in logs.
		// Warn for all unrecognized types including empty string — empty is
		// arguably the most dangerous case since an unset user type silently
		// mints a wildcard session token.
		log.Printf("WARNING: unrecognized user type %q in DefaultScopesForUserType — granting wildcard scopes (backward compat)", userType)
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
