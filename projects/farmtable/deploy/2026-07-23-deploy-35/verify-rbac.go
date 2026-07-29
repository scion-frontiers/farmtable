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
	"google.golang.org/protobuf/proto"
	"github.com/google/uuid"
	_ "github.com/lib/pq"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
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

// generateToken creates a random ft_ token and returns (rawToken, sha256Hash).
func generateToken() (string, string) {
	b := make([]byte, 32)
	_, _ = rand.Read(b)
	raw := "ft_" + hex.EncodeToString(b)
	h := sha256.Sum256([]byte(raw))
	return raw, hex.EncodeToString(h[:])
}

// createScopedToken inserts a token directly into the Postgres database.
// The scopes and collection_ids columns are JSONB (Ent JSON fields).
func createScopedToken(db *sql.DB, userID uuid.UUID, name string, scopes []string, collectionIDs []uuid.UUID) (string, uuid.UUID, error) {
	rawToken, hash := generateToken()
	tokenID := uuid.New()

	// Convert to JSON for JSONB columns
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

// cleanupToken deletes a token from the database.
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
	var collections []*pb.Collection
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
		collections = colResp.GetItems()
		if len(collections) < 2 {
			fmt.Fprintf(os.Stderr, "Need at least 2 collections for scope tests, found %d\n", len(collections))
			os.Exit(1)
		}
		primaryCollectionID = collections[0].GetId()
		secondaryCollectionID = collections[1].GetId()
		fmt.Printf("  Primary collection: %s (%s)\n", primaryCollectionID, collections[0].GetName())
		fmt.Printf("  Secondary collection: %s (%s)\n", secondaryCollectionID, collections[1].GetName())

		// Get user ID from the token owner
		var uid string
		err = db.QueryRow(`SELECT user_id FROM api_tokens WHERE token_hash = (SELECT token_hash FROM api_tokens LIMIT 1) LIMIT 1`).Scan(&uid)
		if err != nil {
			// Try getting any user
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
	// CHECK (a): Backward compatibility - existing token
	// ════════════════════════════════════════════════════════
	fmt.Println("\n=== CHECK (a): Backward compatibility — existing default token ===")

	// a1: Read with existing token
	fmt.Println("--- (a1) ListTasks with existing token ---")
	{
		ctx := dualAuthCtx(iapToken, ftToken)
		resp, err := client.ListTasks(ctx, &pb.ListTasksRequest{})
		r := checkResult{Check: "a1", Action: "ListTasks with existing (pre-Stage4) token — read access"}
		if err != nil {
			st, _ := status.FromError(err)
			r.Pass = false
			r.Error = err.Error()
			r.GRPCCode = st.Code().String()
			r.Detail = "ListTasks with existing token should succeed — backward compat BROKEN"
		} else {
			r.Pass = true
			r.Detail = fmt.Sprintf("ListTasks returned %d tasks — existing token still works for reads", len(resp.GetItems()))
		}
		results = append(results, r)
		fmt.Printf("  Result: pass=%v detail=%s\n", r.Pass, r.Detail)
	}

	// a2: Mutate with existing token
	fmt.Println("--- (a2) CreateTask with existing token ---")
	{
		ctx := dualAuthCtx(iapToken, ftToken)
		created, err := client.CreateTask(ctx, &pb.CreateTaskRequest{
			Name:         "__deploy-35-backward-compat-test__",
			CollectionId: primaryCollectionID,
		})
		r := checkResult{Check: "a2", Action: "CreateTask with existing (pre-Stage4) token — write access"}
		if err != nil {
			st, _ := status.FromError(err)
			r.Pass = false
			r.Error = err.Error()
			r.GRPCCode = st.Code().String()
			r.Detail = "CreateTask with existing token should succeed — backward compat BROKEN for mutations"
		} else {
			r.Pass = true
			r.Detail = fmt.Sprintf("CreateTask returned id=%s — existing token still works for mutations", created.GetId())
			// Cleanup
			ctx2 := dualAuthCtx(iapToken, ftToken)
			_, _ = client.DeleteTask(ctx2, &pb.DeleteTaskRequest{Id: created.GetId()})
			r.Detail += " (test task cleaned up)"
		}
		results = append(results, r)
		fmt.Printf("  Result: pass=%v detail=%s\n", r.Pass, r.Detail)
	}

	// a3: ListCollections with existing token
	fmt.Println("--- (a3) ListCollections with existing token ---")
	{
		ctx := dualAuthCtx(iapToken, ftToken)
		resp, err := client.ListCollections(ctx, &pb.ListCollectionsRequest{})
		r := checkResult{Check: "a3", Action: "ListCollections with existing (pre-Stage4) token — collection read"}
		if err != nil {
			st, _ := status.FromError(err)
			r.Pass = false
			r.Error = err.Error()
			r.GRPCCode = st.Code().String()
			r.Detail = "ListCollections should succeed — FAILED"
		} else {
			r.Pass = true
			r.Detail = fmt.Sprintf("ListCollections returned %d collections — existing token works for collection reads", len(resp.GetItems()))
		}
		results = append(results, r)
		fmt.Printf("  Result: pass=%v detail=%s\n", r.Pass, r.Detail)
	}

	// ════════════════════════════════════════════════════════
	// CHECK (b): Scoped token with task:read + single collection
	// ════════════════════════════════════════════════════════
	fmt.Println("\n=== CHECK (b): Scoped token (task:read, single collection) ===")

	primaryColUUID, _ := uuid.Parse(primaryCollectionID)

	readOnlyToken, readOnlyTokenID, err := createScopedToken(db, userID,
		"deploy-35-verify-readonly",
		[]string{"task:read", "collection:read"},
		[]uuid.UUID{primaryColUUID},
	)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to create read-only scoped token: %v\n", err)
		os.Exit(1)
	}
	tokenCleanups = append(tokenCleanups, readOnlyTokenID)
	fmt.Printf("  Created read-only scoped token: %s (id=%s)\n", readOnlyToken[:15]+"...", readOnlyTokenID)

	// b1: Read tasks in allowed collection — should SUCCEED
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
			r.Detail = "ListTasks in allowed collection should succeed with task:read scope — FAILED"
		} else {
			r.Pass = true
			r.Detail = fmt.Sprintf("ListTasks returned %d tasks — scoped read works in allowed collection", len(resp.GetItems()))
		}
		results = append(results, r)
		fmt.Printf("  Result: pass=%v detail=%s\n", r.Pass, r.Detail)
	}

	// b2: Write tasks in allowed collection — should be REJECTED (no task:write scope)
	fmt.Println("--- (b.ii) CreateTask in allowed collection — should be REJECTED (no write scope) ---")
	{
		ctx := dualAuthCtx(iapToken, readOnlyToken)
		_, err := client.CreateTask(ctx, &pb.CreateTaskRequest{
			Name:         "__deploy-35-should-be-rejected-no-write__",
			CollectionId: primaryCollectionID,
		})
		r := checkResult{Check: "b.ii", Action: "CreateTask in allowed collection WITHOUT task:write scope — should be REJECTED"}
		if err != nil {
			st, _ := status.FromError(err)
			code := st.Code().String()
			if code == "PermissionDenied" || strings.Contains(st.Message(), "scope") {
				r.Pass = true
				r.GRPCCode = code
				r.Detail = fmt.Sprintf("Correctly rejected: code=%s message=%q — scope enforcement works", code, st.Message())
			} else {
				r.Pass = false
				r.Error = err.Error()
				r.GRPCCode = code
				r.Detail = fmt.Sprintf("Rejected with unexpected code=%s message=%q — investigate", code, st.Message())
			}
		} else {
			r.Pass = false
			r.Detail = "CreateTask WITHOUT task:write scope should be rejected but SUCCEEDED — SCOPE ENFORCEMENT BROKEN"
		}
		results = append(results, r)
		fmt.Printf("  Result: pass=%v detail=%s\n", r.Pass, r.Detail)
	}

	// b3: Read tasks in DIFFERENT collection — should be REJECTED (wrong collection)
	fmt.Println("--- (b.iii) ListTasks in DIFFERENT collection — should be REJECTED ---")
	{
		ctx := dualAuthCtx(iapToken, readOnlyToken)
		_, err := client.ListTasks(ctx, &pb.ListTasksRequest{CollectionId: proto.String(secondaryCollectionID)})
		r := checkResult{Check: "b.iii", Action: "ListTasks in DIFFERENT collection — should be REJECTED (collection restriction)"}
		if err != nil {
			st, _ := status.FromError(err)
			code := st.Code().String()
			if code == "PermissionDenied" || strings.Contains(st.Message(), "collection") {
				r.Pass = true
				r.GRPCCode = code
				r.Detail = fmt.Sprintf("Correctly rejected: code=%s message=%q — collection restriction works", code, st.Message())
			} else {
				r.Pass = false
				r.Error = err.Error()
				r.GRPCCode = code
				r.Detail = fmt.Sprintf("Rejected with unexpected code=%s message=%q — investigate", code, st.Message())
			}
		} else {
			r.Pass = false
			r.Detail = "ListTasks in DIFFERENT collection should be rejected but SUCCEEDED — COLLECTION ENFORCEMENT BROKEN"
		}
		results = append(results, r)
		fmt.Printf("  Result: pass=%v detail=%s\n", r.Pass, r.Detail)
	}

	// ════════════════════════════════════════════════════════
	// CHECK (c): Admin wildcard token
	// ════════════════════════════════════════════════════════
	fmt.Println("\n=== CHECK (c): Admin wildcard (*) token ===")

	adminToken, adminTokenID, err := createScopedToken(db, userID,
		"deploy-35-verify-admin",
		[]string{"*"},
		nil, // no collection restriction
	)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to create admin token: %v\n", err)
		os.Exit(1)
	}
	tokenCleanups = append(tokenCleanups, adminTokenID)
	fmt.Printf("  Created admin token: %s (id=%s)\n", adminToken[:15]+"...", adminTokenID)

	// c1: Read all collections
	fmt.Println("--- (c1) ListCollections with admin token ---")
	{
		ctx := dualAuthCtx(iapToken, adminToken)
		resp, err := client.ListCollections(ctx, &pb.ListCollectionsRequest{})
		r := checkResult{Check: "c1", Action: "ListCollections with wildcard admin token"}
		if err != nil {
			st, _ := status.FromError(err)
			r.Pass = false
			r.Error = err.Error()
			r.GRPCCode = st.Code().String()
			r.Detail = "Admin token should have full access — FAILED"
		} else {
			r.Pass = true
			r.Detail = fmt.Sprintf("ListCollections returned %d collections — admin can read all", len(resp.GetItems()))
		}
		results = append(results, r)
		fmt.Printf("  Result: pass=%v detail=%s\n", r.Pass, r.Detail)
	}

	// c2: Create + delete task with admin token
	fmt.Println("--- (c2) CreateTask + DeleteTask with admin token ---")
	{
		ctx := dualAuthCtx(iapToken, adminToken)
		created, err := client.CreateTask(ctx, &pb.CreateTaskRequest{
			Name:         "__deploy-35-admin-verify-test__",
			CollectionId: primaryCollectionID,
		})
		r := checkResult{Check: "c2", Action: "CreateTask + DeleteTask with wildcard admin token (write access)"}
		if err != nil {
			st, _ := status.FromError(err)
			r.Pass = false
			r.Error = err.Error()
			r.GRPCCode = st.Code().String()
			r.Detail = "Admin token should have full write access — FAILED"
		} else {
			r.Pass = true
			r.Detail = fmt.Sprintf("CreateTask returned id=%s — admin can write", created.GetId())
			ctx2 := dualAuthCtx(iapToken, adminToken)
			_, _ = client.DeleteTask(ctx2, &pb.DeleteTaskRequest{Id: created.GetId()})
			r.Detail += " (test task cleaned up)"
		}
		results = append(results, r)
		fmt.Printf("  Result: pass=%v detail=%s\n", r.Pass, r.Detail)
	}

	// c3: Access both collections with admin token
	fmt.Println("--- (c3) ListTasks in both collections with admin token ---")
	{
		ctx := dualAuthCtx(iapToken, adminToken)
		_, err1 := client.ListTasks(ctx, &pb.ListTasksRequest{CollectionId: proto.String(primaryCollectionID)})
		ctx2 := dualAuthCtx(iapToken, adminToken)
		_, err2 := client.ListTasks(ctx2, &pb.ListTasksRequest{CollectionId: proto.String(secondaryCollectionID)})
		r := checkResult{Check: "c3", Action: "ListTasks in primary AND secondary collection with admin token (no collection restriction)"}
		if err1 != nil || err2 != nil {
			r.Pass = false
			r.Detail = fmt.Sprintf("Admin should access all collections — primary err: %v, secondary err: %v", err1, err2)
		} else {
			r.Pass = true
			r.Detail = "Admin token can read tasks in both collections — no collection restriction works"
		}
		results = append(results, r)
		fmt.Printf("  Result: pass=%v detail=%s\n", r.Pass, r.Detail)
	}

	// ════════════════════════════════════════════════════════
	// CHECK (e): Dual-header (IAP + ft) still works
	// ════════════════════════════════════════════════════════
	fmt.Println("\n=== CHECK (e): Dual-header auth (IAP + farmtable token) — ft CLI / decomposer pattern ===")

	// e1: Read via dual-header
	fmt.Println("--- (e1) ListTasks via dual-header (IAP + ft token) ---")
	{
		ctx := dualAuthCtx(iapToken, ftToken)
		resp, err := client.ListTasks(ctx, &pb.ListTasksRequest{})
		r := checkResult{Check: "e1", Action: "ListTasks via dual-header auth (ft CLI / decomposer pattern)"}
		if err != nil {
			st, _ := status.FromError(err)
			r.Pass = false
			r.Error = err.Error()
			r.GRPCCode = st.Code().String()
			r.Detail = "Dual-header pattern should work — FAILED"
		} else {
			r.Pass = true
			r.Detail = fmt.Sprintf("ListTasks returned %d tasks — dual-header pattern works", len(resp.GetItems()))
		}
		results = append(results, r)
		fmt.Printf("  Result: pass=%v detail=%s\n", r.Pass, r.Detail)
	}

	// e2: Mutate via dual-header
	fmt.Println("--- (e2) CreateTask via dual-header ---")
	{
		ctx := dualAuthCtx(iapToken, ftToken)
		created, err := client.CreateTask(ctx, &pb.CreateTaskRequest{
			Name:         "__deploy-35-dual-header-verify__",
			CollectionId: primaryCollectionID,
		})
		r := checkResult{Check: "e2", Action: "CreateTask via dual-header auth (mutating RPC via ft CLI pattern)"}
		if err != nil {
			st, _ := status.FromError(err)
			r.Pass = false
			r.Error = err.Error()
			r.GRPCCode = st.Code().String()
			r.Detail = "Dual-header mutating RPC should work — FAILED"
		} else {
			r.Pass = true
			r.Detail = fmt.Sprintf("CreateTask returned id=%s — dual-header mutating works", created.GetId())
			ctx2 := dualAuthCtx(iapToken, ftToken)
			_, _ = client.DeleteTask(ctx2, &pb.DeleteTaskRequest{Id: created.GetId()})
			r.Detail += " (cleaned up)"
		}
		results = append(results, r)
		fmt.Printf("  Result: pass=%v detail=%s\n", r.Pass, r.Detail)
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
	// Output and summary
	// ════════════════════════════════════════════════════════
	out, _ := json.MarshalIndent(results, "", "  ")
	fmt.Println("\n=== RESULTS JSON ===")
	fmt.Println(string(out))

	os.WriteFile("/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-23-deploy-35/rbac-verification-results.json", out, 0644)

	fmt.Println("\n=== SUMMARY ===")
	allPass := true
	for _, r := range results {
		mark := "PASS"
		if !r.Pass {
			mark = "FAIL"
			allPass = false
		}
		fmt.Printf("  [%s] %s: %s\n", r.Check, mark, r.Action)
	}
	if allPass {
		fmt.Println("\nAll RBAC verification checks PASSED")
	} else {
		fmt.Println("\nSome checks FAILED!")
		os.Exit(1)
	}
}
