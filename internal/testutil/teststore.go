package testutil

import (
	"context"
	"testing"

	"github.com/farmtable-io/farmtable/internal/store"
)

func NewTestStore(t *testing.T) (*store.EntStore, func()) {
	t.Helper()
	ctx := context.Background()
	s, err := store.NewEntStore(ctx, store.StoreOptions{
		Dialect: "sqlite3",
		DSN:     "file::memory:?cache=shared&_fk=1",
		Migrate: true,
	})
	if err != nil {
		t.Fatalf("creating test store: %v", err)
	}
	return s, func() { s.Close() }
}
