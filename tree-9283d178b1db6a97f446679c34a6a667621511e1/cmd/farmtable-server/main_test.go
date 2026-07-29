package main

import "testing"

func TestServerPortPrefersCloudRunPort(t *testing.T) {
	t.Setenv("PORT", "9090")
	t.Setenv("FARMTABLE_PORT", "50051")

	if got := serverPort(); got != "9090" {
		t.Fatalf("serverPort() = %q, want 9090", got)
	}
}

func TestServerPortFallsBackToFarmTablePort(t *testing.T) {
	t.Setenv("PORT", "")
	t.Setenv("FARMTABLE_PORT", "50051")

	if got := serverPort(); got != "50051" {
		t.Fatalf("serverPort() = %q, want 50051", got)
	}
}

func TestServerPortDefaultsTo8080(t *testing.T) {
	t.Setenv("PORT", "")
	t.Setenv("FARMTABLE_PORT", "")

	if got := serverPort(); got != "8080" {
		t.Fatalf("serverPort() = %q, want 8080", got)
	}
}

func TestServerStoreOptionsAppendsSecretPassword(t *testing.T) {
	t.Setenv("FARMTABLE_DB_URL", "host=/cloudsql/project:region:instance dbname=farmtable user=farmtable sslmode=disable")
	t.Setenv("FARMTABLE_DB_DIALECT", "")
	t.Setenv("FARMTABLE_DB_PASSWORD", "secret-password")

	opts, err := serverStoreOptions()
	if err != nil {
		t.Fatalf("serverStoreOptions: %v", err)
	}
	if opts.Dialect != "postgres" {
		t.Fatalf("Dialect = %q, want postgres", opts.Dialect)
	}
	want := "host=/cloudsql/project:region:instance dbname=farmtable user=farmtable sslmode=disable password=secret-password"
	if opts.DSN != want {
		t.Fatalf("DSN = %q, want %q", opts.DSN, want)
	}
	if !opts.Migrate {
		t.Fatal("Migrate = false, want true")
	}
}
