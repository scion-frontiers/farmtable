package server

import (
	"context"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"strings"
	"time"

	"github.com/google/uuid"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

type contextKey string

const userIDKey contextKey = "user_id"
const authEnforcedKey contextKey = "auth_enforced"

const tokenUsageTimeout = 5 * time.Second

func UserIDFromContext(ctx context.Context) (uuid.UUID, bool) {
	id, ok := ctx.Value(userIDKey).(uuid.UUID)
	return id, ok
}

// RequireIdentity extracts the authenticated user ID from the context and
// returns a codes.Unauthenticated error if the user is not identified (i.e.
// the user ID is missing or uuid.Nil). Mutating RPCs must call this at the
// top of their handler to enforce identity-aware access control.
//
// When running in open-access mode (no auth interceptor configured), the
// context will not have the auth-enforced flag set, and this function returns
// uuid.Nil without error — allowing mutating operations to proceed without
// identity. This preserves backward compatibility for deployments without
// token authentication.
func RequireIdentity(ctx context.Context) (uuid.UUID, error) {
	id, ok := UserIDFromContext(ctx)
	if ok && id != uuid.Nil {
		return id, nil
	}
	// If auth was enforced by an interceptor but the user ID is missing or
	// nil, reject the request — the caller authenticated but has no identity.
	if ctx.Value(authEnforcedKey) != nil {
		return uuid.Nil, status.Error(codes.Unauthenticated, "identity required: mutating operations require an authenticated user with a valid identity")
	}
	// Open-access mode: no auth interceptor was configured, so no identity
	// is available. Return uuid.Nil to allow the operation to proceed.
	return uuid.Nil, nil
}

func ContextWithUserID(ctx context.Context, id uuid.UUID) context.Context {
	return context.WithValue(ctx, userIDKey, id)
}

// ContextWithAuthEnforced marks the context as having auth enforcement
// active. This is used by RequireIdentity to distinguish between
// "no auth configured" (open-access mode) and "auth configured but
// identity missing".
func ContextWithAuthEnforced(ctx context.Context) context.Context {
	return context.WithValue(ctx, authEnforcedKey, true)
}

type TokenLookupResult struct {
	UserID    uuid.UUID
	TokenID   uuid.UUID
	ExpiresAt *time.Time
}

type TokenLookup interface {
	LookupByHash(ctx context.Context, hash string) (*TokenLookupResult, error)
	RecordUsage(ctx context.Context, tokenID uuid.UUID)
}

// extractToken retrieves the app-layer auth token from gRPC metadata.
// It checks x-farmtable-token first (required when behind IAP, which
// consumes the Authorization header), then falls back to Authorization: Bearer.
func extractToken(md metadata.MD) string {
	// 1. Custom header (IAP-safe)
	if vals := md.Get("x-farmtable-token"); len(vals) > 0 && vals[0] != "" {
		return vals[0]
	}
	// 2. Standard Authorization: Bearer (direct connections)
	if vals := md.Get("authorization"); len(vals) > 0 {
		val := vals[0]
		if strings.HasPrefix(val, "Bearer ") {
			return strings.TrimPrefix(val, "Bearer ")
		}
		// Has Authorization header but wrong scheme — caller will reject
		return ""
	}
	return ""
}

// isUnauthenticatedEndpoint returns true for RPCs that should bypass auth
// even when token authentication is configured (health/status endpoints).
func isUnauthenticatedEndpoint(fullMethod string) bool {
	switch fullMethod {
	case "/farmtable.v1.FarmTableService/GetVersion",
		"/farmtable.v1.FarmTableService/GetStatus":
		return true
	}
	return false
}

func TokenAuthInterceptor(lookup TokenLookup) grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (interface{}, error) {
		if lookup == nil {
			return handler(ctx, req)
		}

		// Mark that auth enforcement is active so downstream handlers
		// (RequireIdentity) can distinguish "no auth configured" from
		// "auth configured but identity missing".
		ctx = context.WithValue(ctx, authEnforcedKey, true)

		if isUnauthenticatedEndpoint(info.FullMethod) {
			return handler(ctx, req)
		}

		md, ok := metadata.FromIncomingContext(ctx)
		if !ok {
			return nil, status.Error(codes.Unauthenticated, "authentication required")
		}

		token := extractToken(md)
		if token == "" {
			// Check if authorization header exists but has wrong scheme
			if auth := md.Get("authorization"); len(auth) > 0 && !strings.HasPrefix(auth[0], "Bearer ") {
				return nil, status.Error(codes.Unauthenticated, "authorization header must use Bearer scheme")
			}
			return nil, status.Error(codes.Unauthenticated, "authentication required")
		}

		h := sha256.Sum256([]byte(token))
		hash := hex.EncodeToString(h[:])

		result, err := lookup.LookupByHash(ctx, hash)
		if err != nil {
			return nil, status.Error(codes.Unauthenticated, "invalid token")
		}

		if result.ExpiresAt != nil && result.ExpiresAt.Before(time.Now()) {
			return nil, status.Error(codes.Unauthenticated, "token expired")
		}

		recordTokenUsage(lookup, result.TokenID)

		ctx = ContextWithUserID(ctx, result.UserID)
		return handler(ctx, req)
	}
}

func TokenAuthStreamInterceptor(lookup TokenLookup) grpc.StreamServerInterceptor {
	return func(srv interface{}, ss grpc.ServerStream, info *grpc.StreamServerInfo, handler grpc.StreamHandler) error {
		if lookup == nil {
			return handler(srv, ss)
		}

		// Mark that auth enforcement is active.
		enforcedCtx := context.WithValue(ss.Context(), authEnforcedKey, true)
		ss = &authenticatedStream{ServerStream: ss, ctx: enforcedCtx}

		if isUnauthenticatedEndpoint(info.FullMethod) {
			return handler(srv, ss)
		}

		md, ok := metadata.FromIncomingContext(ss.Context())
		if !ok {
			return status.Error(codes.Unauthenticated, "authentication required")
		}

		token := extractToken(md)
		if token == "" {
			// Check if authorization header exists but has wrong scheme
			if auth := md.Get("authorization"); len(auth) > 0 && !strings.HasPrefix(auth[0], "Bearer ") {
				return status.Error(codes.Unauthenticated, "authorization header must use Bearer scheme")
			}
			return status.Error(codes.Unauthenticated, "authentication required")
		}

		h := sha256.Sum256([]byte(token))
		hash := hex.EncodeToString(h[:])

		result, err := lookup.LookupByHash(ss.Context(), hash)
		if err != nil {
			return status.Error(codes.Unauthenticated, "invalid token")
		}

		if result.ExpiresAt != nil && result.ExpiresAt.Before(time.Now()) {
			return status.Error(codes.Unauthenticated, "token expired")
		}

		recordTokenUsage(lookup, result.TokenID)

		wrapped := &authenticatedStream{
			ServerStream: ss,
			ctx:          ContextWithUserID(ss.Context(), result.UserID),
		}
		return handler(srv, wrapped)
	}
}

func recordTokenUsage(lookup TokenLookup, tokenID uuid.UUID) {
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), tokenUsageTimeout)
		defer cancel()
		lookup.RecordUsage(ctx, tokenID)
	}()
}

type authenticatedStream struct {
	grpc.ServerStream
	ctx context.Context
}

func (s *authenticatedStream) Context() context.Context {
	return s.ctx
}

type legacyTokenLookup struct {
	token  string
	userID uuid.UUID
}

// Deprecated: LegacyTokenAuth returns uuid.Nil as the user ID, which will
// always fail identity checks required by mutating RPCs. Use
// NewStoreTokenLookup instead, which resolves tokens to real user identities.
// This function is retained only for backward compatibility in tests and will
// be removed in a future release.
func LegacyTokenAuth(validToken string) TokenLookup {
	if validToken == "" {
		return nil
	}
	return &legacyTokenLookup{token: validToken, userID: uuid.Nil}
}

func (l *legacyTokenLookup) LookupByHash(_ context.Context, hash string) (*TokenLookupResult, error) {
	h := sha256.Sum256([]byte(l.token))
	expected := hex.EncodeToString(h[:])
	if subtle.ConstantTimeCompare([]byte(hash), []byte(expected)) != 1 {
		return nil, status.Error(codes.Unauthenticated, "invalid token")
	}
	return &TokenLookupResult{UserID: l.userID}, nil
}

func (l *legacyTokenLookup) RecordUsage(_ context.Context, _ uuid.UUID) {}
