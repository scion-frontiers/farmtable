package server

import (
	"context"
	"log"

	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/google/uuid"
)

type StoreTokenLookup struct {
	store store.Store
}

func NewStoreTokenLookup(s store.Store) *StoreTokenLookup {
	return &StoreTokenLookup{store: s}
}

func (l *StoreTokenLookup) LookupByHash(ctx context.Context, hash string) (*TokenLookupResult, error) {
	tok, err := l.store.LookupToken(ctx, hash)
	if err != nil {
		return nil, err
	}
	result := &TokenLookupResult{
		UserID:        tok.UserID,
		TokenID:       tok.ID,
		Scopes:        tok.Scopes,
		CollectionIDs: tok.CollectionIds,
	}
	if tok.ExpiresAt != nil {
		result.ExpiresAt = tok.ExpiresAt
	}
	return result, nil
}

func (l *StoreTokenLookup) RecordUsage(ctx context.Context, tokenID uuid.UUID) {
	if err := l.store.UpdateTokenLastUsed(ctx, tokenID); err != nil {
		log.Printf("failed to update token last_used_at: %v", err)
	}
}
