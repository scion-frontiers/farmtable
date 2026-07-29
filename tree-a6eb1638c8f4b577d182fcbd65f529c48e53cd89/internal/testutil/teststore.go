package testutil

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"strings"
	"testing"

	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/google/uuid"
	_ "github.com/lib/pq"
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

func NewTestStorePostgres(t *testing.T) (*store.EntStore, func()) {
	t.Helper()

	dsn := os.Getenv("FARMTABLE_TEST_POSTGRES_URL")
	if dsn == "" {
		t.Skip("FARMTABLE_TEST_POSTGRES_URL not set, skipping Postgres test")
	}

	schemaName := fmt.Sprintf("test_%s", strings.ReplaceAll(uuid.New().String(), "-", "")[:12])

	db, err := sql.Open("postgres", dsn)
	if err != nil {
		t.Fatalf("connecting to postgres: %v", err)
	}
	if _, err := db.Exec("CREATE SCHEMA " + schemaName); err != nil {
		t.Fatalf("creating schema %s: %v", schemaName, err)
	}
	db.Close()

	schemaDSN := dsn
	if strings.Contains(schemaDSN, "?") {
		schemaDSN += "&search_path=" + schemaName
	} else {
		schemaDSN += "?search_path=" + schemaName
	}

	ctx := context.Background()
	s, err := store.NewEntStore(ctx, store.StoreOptions{
		Dialect: "postgres",
		DSN:     schemaDSN,
		Migrate: true,
	})
	if err != nil {
		t.Fatalf("creating postgres test store: %v", err)
	}

	return s, func() {
		s.Close()
		db2, _ := sql.Open("postgres", dsn)
		db2.Exec("DROP SCHEMA " + schemaName + " CASCADE")
		db2.Close()
	}
}
