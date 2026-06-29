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

const tokenUsageTimeout = 5 * time.Second

func UserIDFromContext(ctx context.Context) (uuid.UUID, bool) {
	id, ok := ctx.Value(userIDKey).(uuid.UUID)
	return id, ok
}

func ContextWithUserID(ctx context.Context, id uuid.UUID) context.Context {
	return context.WithValue(ctx, userIDKey, id)
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

func TokenAuthInterceptor(lookup TokenLookup) grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (interface{}, error) {
		if lookup == nil {
			return handler(ctx, req)
		}

		md, ok := metadata.FromIncomingContext(ctx)
		if !ok {
			return handler(ctx, req)
		}
		auth := md.Get("authorization")
		if len(auth) == 0 {
			return handler(ctx, req)
		}
		val := auth[0]
		if !strings.HasPrefix(val, "Bearer ") {
			return nil, status.Error(codes.Unauthenticated, "authorization header must use Bearer scheme")
		}
		token := strings.TrimPrefix(val, "Bearer ")

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

		md, ok := metadata.FromIncomingContext(ss.Context())
		if !ok {
			return handler(srv, ss)
		}
		auth := md.Get("authorization")
		if len(auth) == 0 {
			return handler(srv, ss)
		}
		val := auth[0]
		if !strings.HasPrefix(val, "Bearer ") {
			return status.Error(codes.Unauthenticated, "authorization header must use Bearer scheme")
		}
		token := strings.TrimPrefix(val, "Bearer ")

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
