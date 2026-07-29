package main

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/tls"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"

	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
	"github.com/google/uuid"
	_ "github.com/lib/pq"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"
)

const serverAddr = "farmtable-486315127503.us-central1.run.app:443"

type checkResult struct {
	Check    string `json:"check"`
	Action   string `json:"action"`
	Pass     bool   `json:"pass"`
	Detail   string `json:"detail"`
	Error    string `json:"error,omitempty"`
	GRPCCode string `json:"grpc_code,omitempty"`
}

func connect() (*grpc.ClientConn, error) {
	return grpc.NewClient(serverAddr,
		grpc.WithTransportCredentials(credentials.NewTLS(&tls.Config{})),
	)
}

func dualAuthCtx(iapToken, ftToken string) context.Context {
	ctx, _ := context.WithTimeout(context.Background(), 15*time.Second)
	md := metadata.Pairs(
		"authorization", "Bearer "+iapToken,
		"x-farmtable-token", ftToken,
	)
	return metadata.NewOutgoingContext(ctx, md)
}

func iapOnlyCtx(iapToken string) context.Context {
	ctx, _ := context.WithTimeout(context.Background(), 15*time.Second)
	md := metadata.Pairs("authorization", "Bearer "+iapToken)
	return metadata.NewOutgoingContext(ctx, md)
}

func noAuthCtx() context.Context {
	ctx, _ := context.WithTimeout(context.Background(), 15*time.Second)
	return ctx
}

// generateToken creates a random ft_ token and returns (rawToken, sha256Hash).
func generateToken() (string, string) {
	b := make([]byte, 32)
	_, _ = rand.Read(b)
	raw := "ft_" + hex.EncodeToString(b)
	h := sha256.Sum256([]byte(raw))
	return raw, hex.EncodeToString(h[:])
}

// createScopedToken inserts a token directly into the Postgres database.
func createScopedToken(db *sql.DB, userID uuid.UUID, name string, scopes []string, collectionIDs []uuid.UUID) (string, uuid.UUID, error) {
	rawToken, hash := generateToken()
	tokenID := uuid.New()

	scopesJSON, _ := json.Marshal(scopes)
	if len(scopes) == 0 {
		scopesJSON = []byte("null")
	}

	var colIDsJSON []byte
	if len(collectionIDs) > 0 {
		ids := make([]string, len(collectionIDs))
		for i, id := range collectionIDs {
			ids[i] = id.String()
		}
		colIDsJSON, _ = json.Marshal(ids)
	} else {
		colIDsJSON = []byte("null")
	}

	_, err := db.Exec(`
		INSERT INTO api_tokens (id, user_id, name, token_hash, scopes, collection_ids, created_at)
		VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, NOW())
	`, tokenID, userID, name, hash, string(scopesJSON), string(colIDsJSON))
	if err != nil {
		return "", uuid.Nil, fmt.Errorf("inserting token: %w", err)
	}

	return rawToken, tokenID, nil
}

func cleanupToken(db *sql.DB, tokenID uuid.UUID) {
	_, _ = db.Exec(`DELETE FROM api_tokens WHERE id = $1`, tokenID)
}

func main() {
	iapToken := os.Getenv("IAP_TOKEN")
	ftToken := os.Getenv("FT_TOKEN")
	dbDSN := os.Getenv("DB_DSN")

	if iapToken == "" || ftToken == "" || dbDSN == "" {
		fmt.Fprintf(os.Stderr, "IAP_TOKEN, FT_TOKEN, and DB_DSN must be set\n")
		os.Exit(1)
	}

	// Connect to Postgres
	db, err := sql.Open("postgres", dbDSN)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to connect to DB: %v\n", err)
		os.Exit(1)
	}
	defer db.Close()
	if err := db.Ping(); err != nil {
		fmt.Fprintf(os.Stderr, "Failed to ping DB: %v\n", err)
		os.Exit(1)
	}
	fmt.Println("Connected to Postgres database")

	// Connect to gRPC
	conn, err := connect()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to connect gRPC: %v\n", err)
		os.Exit(1)
	}
	defer conn.Close()
	client := pb.NewFarmTableServiceClient(conn)

	results := []checkResult{}
	var tokenCleanups []uuid.UUID

	// ── Discover collections and a user ID ──
	fmt.Println("=== Discovering collections ===")
	var primaryCollectionID string
	var secondaryCollectionID string
	var userID uuid.UUID
	{
		ctx := dualAuthCtx(iapToken, ftToken)
		colResp, err := client.ListCollections(ctx, &pb.ListCollectionsRequest{})
		if err != nil {
			fmt.Fprintf(os.Stderr, "Failed to list collections: %v\n", err)
			os.Exit(1)
		}
		collections := colResp.GetItems()
		if len(collections) < 2 {
			fmt.Fprintf(os.Stderr, "Need at least 2 collections, found %d\n", len(collections))
			os.Exit(1)
		}
		primaryCollectionID = collections[0].GetId()
		secondaryCollectionID = collections[1].GetId()
		fmt.Printf("  Primary collection: %s (%s)\n", primaryCollectionID, collections[0].GetName())
		fmt.Printf("  Secondary collection: %s (%s)\n", secondaryCollectionID, collections[1].GetName())

		var uid string
		err = db.QueryRow(`SELECT user_id FROM api_tokens WHERE token_hash = (SELECT token_hash FROM api_tokens LIMIT 1) LIMIT 1`).Scan(&uid)
		if err != nil {
			err = db.QueryRow(`SELECT id FROM users LIMIT 1`).Scan(&uid)
			if err != nil {
				fmt.Fprintf(os.Stderr, "Failed to find a user: %v\n", err)
				os.Exit(1)
			}
		}
		userID, _ = uuid.Parse(uid)
		fmt.Printf("  User ID for scoped tokens: %s\n", userID)
	}

	// ════════════════════════════════════════════════════════
	// CHECK (b): ft CLI with dual-header — RBAC still works
	// ════════════════════════════════════════════════════════

	// ── b-sub: Backward compat with existing token ──
	fmt.Println("\n=== CHECK (b): Backward compat — existing default token ===")

	// b/a1: Read with existing token
	fmt.Println("--- (b/a1) ListTasks with existing token ---")
	{
		ctx := dualAuthCtx(iapToken, ftToken)
		resp, err := client.ListTasks(ctx, &pb.ListTasksRequest{})
		r := checkResult{Check: "b/a1", Action: "ListTasks with existing (pre-Stage4) token — backward compat read"}
		if err != nil {
			st, _ := status.FromError(err)
			r.Pass = false
			r.Error = err.Error()
			r.GRPCCode = st.Code().String()
			r.Detail = "Backward compat BROKEN — existing token can't read"
		} else {
			r.Pass = true
			r.Detail = fmt.Sprintf("ListTasks returned %d tasks — existing token read works", len(resp.GetItems()))
		}
		results = append(results, r)
		fmt.Printf("  %s\n", r.Detail)
	}

	// b/a2: Mutate with existing token
	fmt.Println("--- (b/a2) CreateTask with existing token ---")
	{
		ctx := dualAuthCtx(iapToken, ftToken)
		created, err := client.CreateTask(ctx, &pb.CreateTaskRequest{
			Name:         "__deploy-37-backward-compat-test__",
			CollectionId: primaryCollectionID,
		})
		r := checkResult{Check: "b/a2", Action: "CreateTask with existing token — backward compat write"}
		if err != nil {
			st, _ := status.FromError(err)
			r.Pass = false
			r.Error = err.Error()
			r.GRPCCode = st.Code().String()
			r.Detail = "Backward compat BROKEN — existing token can't write"
		} else {
			r.Pass = true
			r.Detail = fmt.Sprintf("CreateTask returned id=%s — existing token write works", created.GetId())
			ctx2 := dualAuthCtx(iapToken, ftToken)
			_, _ = client.DeleteTask(ctx2, &pb.DeleteTaskRequest{Id: created.GetId()})
			r.Detail += " (cleaned up)"
		}
		results = append(results, r)
		fmt.Printf("  %s\n", r.Detail)
	}

	// b/a3: ListCollections
	fmt.Println("--- (b/a3) ListCollections with existing token ---")
	{
		ctx := dualAuthCtx(iapToken, ftToken)
		resp, err := client.ListCollections(ctx, &pb.ListCollectionsRequest{})
		r := checkResult{Check: "b/a3", Action: "ListCollections with existing token"}
		if err != nil {
			st, _ := status.FromError(err)
			r.Pass = false
			r.Error = err.Error()
			r.GRPCCode = st.Code().String()
		} else {
			r.Pass = true
			r.Detail = fmt.Sprintf("ListCollections returned %d — existing token collection access works", len(resp.GetItems()))
		}
		results = append(results, r)
		fmt.Printf("  %s\n", r.Detail)
	}

	// ── b-sub: Scoped token enforcement ──
	fmt.Println("\n=== CHECK (b): Scoped token enforcement ===")
	primaryColUUID, _ := uuid.Parse(primaryCollectionID)

	readOnlyToken, readOnlyTokenID, err := createScopedToken(db, userID,
		"deploy-37-verify-readonly",
		[]string{"task:read", "collection:read"},
		[]uuid.UUID{primaryColUUID},
	)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to create read-only scoped token: %v\n", err)
		os.Exit(1)
	}
	tokenCleanups = append(tokenCleanups, readOnlyTokenID)

	// b.i: Read in allowed collection
	fmt.Println("--- (b.i) ListTasks in allowed collection — should SUCCEED ---")
	{
		ctx := dualAuthCtx(iapToken, readOnlyToken)
		resp, err := client.ListTasks(ctx, &pb.ListTasksRequest{CollectionId: proto.String(primaryCollectionID)})
		r := checkResult{Check: "b.i", Action: "ListTasks in allowed collection with task:read scope"}
		if err != nil {
			st, _ := status.FromError(err)
			r.Pass = false
			r.Error = err.Error()
			r.GRPCCode = st.Code().String()
		} else {
			r.Pass = true
			r.Detail = fmt.Sprintf("ListTasks returned %d tasks — scoped read works", len(resp.GetItems()))
		}
		results = append(results, r)
		fmt.Printf("  %s\n", r.Detail)
	}

	// b.ii: Write blocked (no task:write scope)
	fmt.Println("--- (b.ii) CreateTask — should be REJECTED (no write scope) ---")
	{
		ctx := dualAuthCtx(iapToken, readOnlyToken)
		_, err := client.CreateTask(ctx, &pb.CreateTaskRequest{
			Name:         "__deploy-37-should-be-rejected__",
			CollectionId: primaryCollectionID,
		})
		r := checkResult{Check: "b.ii", Action: "CreateTask WITHOUT task:write scope — should be REJECTED"}
		if err != nil {
			st, _ := status.FromError(err)
			code := st.Code().String()
			if code == "PermissionDenied" || strings.Contains(st.Message(), "scope") {
				r.Pass = true
				r.GRPCCode = code
				r.Detail = fmt.Sprintf("Correctly rejected: code=%s msg=%q", code, st.Message())
			} else {
				r.Pass = false
				r.Error = err.Error()
				r.GRPCCode = code
				r.Detail = fmt.Sprintf("Rejected with unexpected code=%s msg=%q", code, st.Message())
			}
		} else {
			r.Pass = false
			r.Detail = "CreateTask WITHOUT task:write scope should be rejected but SUCCEEDED — SCOPE ENFORCEMENT BROKEN"
		}
		results = append(results, r)
		fmt.Printf("  %s\n", r.Detail)
	}

	// b.iii: Cross-collection blocked
	fmt.Println("--- (b.iii) ListTasks in DIFFERENT collection — should be REJECTED ---")
	{
		ctx := dualAuthCtx(iapToken, readOnlyToken)
		_, err := client.ListTasks(ctx, &pb.ListTasksRequest{CollectionId: proto.String(secondaryCollectionID)})
		r := checkResult{Check: "b.iii", Action: "ListTasks in DIFFERENT collection — should be REJECTED"}
		if err != nil {
			st, _ := status.FromError(err)
			code := st.Code().String()
			if code == "PermissionDenied" || strings.Contains(st.Message(), "collection") {
				r.Pass = true
				r.GRPCCode = code
				r.Detail = fmt.Sprintf("Correctly rejected: code=%s msg=%q", code, st.Message())
			} else {
				r.Pass = false
				r.Error = err.Error()
				r.GRPCCode = code
				r.Detail = fmt.Sprintf("Rejected with unexpected code=%s msg=%q", code, st.Message())
			}
		} else {
			r.Pass = false
			r.Detail = "ListTasks in DIFFERENT collection should be rejected — COLLECTION ENFORCEMENT BROKEN"
		}
		results = append(results, r)
		fmt.Printf("  %s\n", r.Detail)
	}

	// ── Check (d): GetVersion / GetStatus unauthenticated ──
	fmt.Println("\n=== CHECK (d): GetVersion/GetStatus unauthenticated ===")

	// d1: GetVersion — should work without auth (exempt RPC)
	fmt.Println("--- (d1) GetVersion unauthenticated (via IAP only) ---")
	{
		ctx := iapOnlyCtx(iapToken)
		resp, err := client.GetVersion(ctx, &pb.GetVersionRequest{})
		r := checkResult{Check: "d1", Action: "GetVersion with IAP only (no ft token) — exempt RPC"}
		if err != nil {
			st, _ := status.FromError(err)
			r.Pass = false
			r.Error = err.Error()
			r.GRPCCode = st.Code().String()
			r.Detail = "GetVersion should be exempt from token auth — FAILED"
		} else {
			r.Pass = true
			r.Detail = fmt.Sprintf("GetVersion returned server_version=%q — exempt RPC works", resp.GetServerVersion())
		}
		results = append(results, r)
		fmt.Printf("  %s\n", r.Detail)
	}

	// d2: GetStatus — should work without auth (exempt RPC)
	fmt.Println("--- (d2) GetStatus unauthenticated (via IAP only) ---")
	{
		ctx := iapOnlyCtx(iapToken)
		resp, err := client.GetStatus(ctx, &pb.GetStatusRequest{})
		r := checkResult{Check: "d2", Action: "GetStatus with IAP only (no ft token) — exempt RPC"}
		if err != nil {
			st, _ := status.FromError(err)
			r.Pass = false
			r.Error = err.Error()
			r.GRPCCode = st.Code().String()
			r.Detail = "GetStatus should be exempt from token auth — FAILED"
		} else {
			r.Pass = true
			r.Detail = fmt.Sprintf("GetStatus returned server_mode=%q uptime_seconds=%v — exempt RPC works", resp.GetServerMode(), resp.GetUptimeSeconds())
		}
		results = append(results, r)
		fmt.Printf("  %s\n", r.Detail)
	}

	// ── Dual-header auth (ft CLI pattern) ──
	fmt.Println("\n=== CHECK (b-dual): Dual-header auth ===")

	// Dual-header read
	fmt.Println("--- (b/e1) ListTasks via dual-header ---")
	{
		ctx := dualAuthCtx(iapToken, ftToken)
		resp, err := client.ListTasks(ctx, &pb.ListTasksRequest{})
		r := checkResult{Check: "b/e1", Action: "ListTasks via dual-header auth (ft CLI pattern)"}
		if err != nil {
			st, _ := status.FromError(err)
			r.Pass = false
			r.Error = err.Error()
			r.GRPCCode = st.Code().String()
		} else {
			r.Pass = true
			r.Detail = fmt.Sprintf("ListTasks returned %d tasks — dual-header works", len(resp.GetItems()))
		}
		results = append(results, r)
		fmt.Printf("  %s\n", r.Detail)
	}

	// Dual-header mutate
	fmt.Println("--- (b/e2) CreateTask via dual-header ---")
	{
		ctx := dualAuthCtx(iapToken, ftToken)
		created, err := client.CreateTask(ctx, &pb.CreateTaskRequest{
			Name:         "__deploy-37-dual-header-verify__",
			CollectionId: primaryCollectionID,
		})
		r := checkResult{Check: "b/e2", Action: "CreateTask via dual-header auth (mutating RPC)"}
		if err != nil {
			st, _ := status.FromError(err)
			r.Pass = false
			r.Error = err.Error()
			r.GRPCCode = st.Code().String()
		} else {
			r.Pass = true
			r.Detail = fmt.Sprintf("CreateTask returned id=%s — dual-header mutation works", created.GetId())
			ctx2 := dualAuthCtx(iapToken, ftToken)
			_, _ = client.DeleteTask(ctx2, &pb.DeleteTaskRequest{Id: created.GetId()})
			r.Detail += " (cleaned up)"
		}
		results = append(results, r)
		fmt.Printf("  %s\n", r.Detail)
	}

	// ════════════════════════════════════════════════════════
	// Cleanup scoped tokens
	// ════════════════════════════════════════════════════════
	fmt.Println("\n=== Cleaning up test tokens ===")
	for _, id := range tokenCleanups {
		cleanupToken(db, id)
		fmt.Printf("  Deleted token %s\n", id)
	}

	// ════════════════════════════════════════════════════════
	// Output
	// ════════════════════════════════════════════════════════
	out, _ := json.MarshalIndent(results, "", "  ")
	fmt.Println("\n=== RESULTS JSON ===")
	fmt.Println(string(out))

	os.WriteFile("/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-23-deploy-37/rbac-verification-results.json", out, 0644)

	fmt.Println("\n=== SUMMARY ===")
	allPass := true
	for _, r := range results {
		mark := "PASS"
		if !r.Pass {
			mark = "FAIL"
			allPass = false
		}
		fmt.Printf("  [%s] %s: %s — %s\n", r.Check, mark, r.Action, r.Detail)
	}
	if allPass {
		fmt.Println("\nAll verification checks PASSED")
	} else {
		fmt.Println("\nSome checks FAILED!")
		os.Exit(1)
	}
}
