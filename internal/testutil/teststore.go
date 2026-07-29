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

// NewTestStore returns a store backed by an in-memory SQLite database that is
// private to this one call.
//
// The database is named, and the name is unique per call. This matters more
// than it looks. The unnamed DSN "file::memory:?cache=shared" denotes ONE
// process-wide database shared by every connection in the test binary, and
// SQLite destroys it only when the LAST connection to it closes. Test isolation
// under that DSN is therefore not a property of the test -- it is a race on
// connection lifetimes. Any connection outliving its test by even a moment,
// such as the detached goroutine in recordTokenUsage (internal/server/auth.go),
// keeps the database alive and hands the next test the previous test's rows.
// That is how TestListUsers came to see three users when it had created two.
//
// A unique name per store makes the databases disjoint by construction, so no
// goroutine lifetime can leak state from one test into another.
func NewTestStore(t *testing.T) (*store.EntStore, func()) {
	t.Helper()
	s := openTestStore(t, newTestDSN())
	return s, func() { s.Close() }
}

// NewTestStorePair returns two stores that deliberately share ONE in-memory
// database, plus a cleanup that closes both.
//
// Use this only where a test needs two handles onto the same rows. It exists
// because the old process-wide DSN gave every store in the binary that property
// by accident, and a small number of tests were built on it without saying so.
// Making the sharing explicit at the call site is the point: a reader can now
// see that two stores are the same database, instead of having to know it.
func NewTestStorePair(t *testing.T) (*store.EntStore, *store.EntStore, func()) {
	t.Helper()
	dsn := newTestDSN()
	a := openTestStore(t, dsn)
	b := openTestStore(t, dsn)
	return a, b, func() {
		b.Close()
		a.Close()
	}
}

// newTestDSN names a fresh in-memory database. The name must be unique per
// database and the DSN must keep cache=shared, so that the connections in one
// pool reach the same database while different pools stay disjoint.
func newTestDSN() string {
	return fmt.Sprintf("file:testdb-%s?mode=memory&cache=shared&_fk=1", uuid.New())
}

func openTestStore(t *testing.T, dsn string) *store.EntStore {
	t.Helper()
	s, err := store.NewEntStore(context.Background(), store.StoreOptions{
		Dialect: "sqlite3",
		DSN:     dsn,
		Migrate: true,
	})
	if err != nil {
		t.Fatalf("creating test store: %v", err)
	}
	return s
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
