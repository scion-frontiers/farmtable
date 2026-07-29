package main

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"

	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
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

func main() {
	iapToken := os.Getenv("IAP_TOKEN")
	ftToken := os.Getenv("FT_TOKEN")

	if iapToken == "" || ftToken == "" {
		fmt.Fprintf(os.Stderr, "IAP_TOKEN and FT_TOKEN must be set\n")
		os.Exit(1)
	}

	conn, err := connect()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to connect: %v\n", err)
		os.Exit(1)
	}
	defer conn.Close()

	client := pb.NewFarmTableServiceClient(conn)
	results := []checkResult{}

	// ── Check (c1): GetVersion WITHOUT farmtable token (only IAP) ──
	fmt.Println("=== Check (c1): GetVersion without farmtable token ===")
	{
		ctx := iapOnlyCtx(iapToken)
		resp, err := client.GetVersion(ctx, &pb.GetVersionRequest{})
		r := checkResult{Check: "c1", Action: "GetVersion without farmtable token (exempt endpoint)"}
		if err != nil {
			st, _ := status.FromError(err)
			r.Pass = false
			r.Error = err.Error()
			r.GRPCCode = st.Code().String()
			r.Detail = "GetVersion should be exempt — FAILED"
		} else {
			r.Pass = true
			r.Detail = fmt.Sprintf("GetVersion returned server_version=%q — exempt endpoint works unauthenticated", resp.GetServerVersion())
		}
		results = append(results, r)
		fmt.Printf("  Result: pass=%v detail=%s\n", r.Pass, r.Detail)
	}

	// ── Check (c2): GetStatus WITHOUT farmtable token (only IAP) ──
	fmt.Println("=== Check (c2): GetStatus without farmtable token ===")
	{
		ctx := iapOnlyCtx(iapToken)
		resp, err := client.GetStatus(ctx, &pb.GetStatusRequest{})
		r := checkResult{Check: "c2", Action: "GetStatus without farmtable token (exempt endpoint)"}
		if err != nil {
			st, _ := status.FromError(err)
			r.Pass = false
			r.Error = err.Error()
			r.GRPCCode = st.Code().String()
			r.Detail = "GetStatus should be exempt — FAILED"
		} else {
			r.Pass = true
			r.Detail = fmt.Sprintf("GetStatus returned server=%q version=%q — exempt endpoint works unauthenticated", resp.GetServer(), resp.GetServerVersion())
		}
		results = append(results, r)
		fmt.Printf("  Result: pass=%v detail=%s\n", r.Pass, r.Detail)
	}

	// ── Check (a1): ListTasks with dual-header auth (read RPC) ──
	fmt.Println("=== Check (a1): ListTasks with dual-header auth ===")
	{
		ctx := dualAuthCtx(iapToken, ftToken)
		resp, err := client.ListTasks(ctx, &pb.ListTasksRequest{})
		r := checkResult{Check: "a1", Action: "ListTasks with dual-header auth (read RPC)"}
		if err != nil {
			st, _ := status.FromError(err)
			r.Pass = false
			r.Error = err.Error()
			r.GRPCCode = st.Code().String()
			r.Detail = "ListTasks with valid auth should succeed — FAILED"
		} else {
			r.Pass = true
			r.Detail = fmt.Sprintf("ListTasks returned %d tasks — dual-header auth works for reads", len(resp.GetItems()))
		}
		results = append(results, r)
		fmt.Printf("  Result: pass=%v detail=%s\n", r.Pass, r.Detail)
	}

	// ── Get a collection ID for mutating test ──
	var collectionID string
	{
		ctx := dualAuthCtx(iapToken, ftToken)
		colResp, err := client.ListCollections(ctx, &pb.ListCollectionsRequest{})
		if err != nil {
			fmt.Fprintf(os.Stderr, "Failed to list collections: %v\n", err)
			os.Exit(1)
		}
		if len(colResp.GetItems()) == 0 {
			fmt.Fprintf(os.Stderr, "No collections found — cannot test mutating RPCs\n")
			os.Exit(1)
		}
		// Pick first non-external collection (jibo)
		for _, c := range colResp.GetItems() {
			collectionID = c.GetId()
			if c.GetName() == "jibo" {
				break
			}
		}
		fmt.Printf("  Using collection: %s\n", collectionID)
	}

	// ── Check (a2): Mutating RPC with dual-header auth ──
	fmt.Println("=== Check (a2): CreateTask + DeleteTask with dual-header auth ===")
	{
		ctx := dualAuthCtx(iapToken, ftToken)
		created, err := client.CreateTask(ctx, &pb.CreateTaskRequest{
			Name:         "__deploy-34-verification-test__",
			CollectionId: collectionID,
		})
		r := checkResult{Check: "a2", Action: "CreateTask with dual-header auth (mutating RPC)"}
		if err != nil {
			st, _ := status.FromError(err)
			r.Pass = false
			r.Error = err.Error()
			r.GRPCCode = st.Code().String()
			r.Detail = "CreateTask with valid auth should succeed — FAILED"
		} else {
			r.Pass = true
			r.Detail = fmt.Sprintf("CreateTask returned id=%s — mutating RPC with identity works", created.GetId())
			// Clean up: delete the test task
			ctx2 := dualAuthCtx(iapToken, ftToken)
			_, delErr := client.DeleteTask(ctx2, &pb.DeleteTaskRequest{Id: created.GetId()})
			if delErr != nil {
				r.Detail += fmt.Sprintf(" (cleanup delete failed: %v)", delErr)
			} else {
				r.Detail += " (test task cleaned up successfully)"
			}
		}
		results = append(results, r)
		fmt.Printf("  Result: pass=%v detail=%s\n", r.Pass, r.Detail)
	}

	// ── Check (b1): Unauthenticated mutating RPC should be REJECTED ──
	fmt.Println("=== Check (b1): CreateTask WITHOUT farmtable token (should be rejected) ===")
	{
		ctx := iapOnlyCtx(iapToken)
		_, err := client.CreateTask(ctx, &pb.CreateTaskRequest{
			Name:         "__deploy-34-should-be-rejected__",
			CollectionId: collectionID,
		})
		r := checkResult{Check: "b1", Action: "CreateTask without farmtable token (should be REJECTED)"}
		if err != nil {
			st, _ := status.FromError(err)
			code := st.Code().String()
			if strings.Contains(strings.ToLower(code), "unauthenticated") ||
				strings.Contains(strings.ToLower(st.Message()), "authentication required") {
				r.Pass = true
				r.GRPCCode = code
				r.Detail = fmt.Sprintf("Correctly rejected: code=%s message=%q — Stage 1 mandatory auth enforcement working", code, st.Message())
			} else {
				r.Pass = false
				r.Error = err.Error()
				r.GRPCCode = code
				r.Detail = fmt.Sprintf("Rejected with unexpected code=%s — needs investigation", code)
			}
		} else {
			r.Pass = false
			r.Detail = "CreateTask WITHOUT auth should have been rejected but SUCCEEDED — CRITICAL: auth enforcement NOT working!"
		}
		results = append(results, r)
		fmt.Printf("  Result: pass=%v detail=%s\n", r.Pass, r.Detail)
	}

	// ── Check (b2): ListTasks WITHOUT farmtable token should also be REJECTED ──
	fmt.Println("=== Check (b2): ListTasks WITHOUT farmtable token (should be rejected) ===")
	{
		ctx := iapOnlyCtx(iapToken)
		_, err := client.ListTasks(ctx, &pb.ListTasksRequest{})
		r := checkResult{Check: "b2", Action: "ListTasks without farmtable token (should be REJECTED under Stage 1)"}
		if err != nil {
			st, _ := status.FromError(err)
			code := st.Code().String()
			r.Pass = true
			r.GRPCCode = code
			r.Detail = fmt.Sprintf("Correctly rejected: code=%s message=%q — mandatory auth enforced on non-exempt RPCs", code, st.Message())
		} else {
			r.Pass = false
			r.Detail = "ListTasks without farmtable token succeeded — auth enforcement not active on read RPCs"
		}
		results = append(results, r)
		fmt.Printf("  Result: pass=%v detail=%s\n", r.Pass, r.Detail)
	}

	// Output results as JSON
	out, _ := json.MarshalIndent(results, "", "  ")
	fmt.Println("\n=== RESULTS JSON ===")
	fmt.Println(string(out))

	// Write to file
	os.WriteFile("/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-23-deploy-34/grpc-access-path-results.json", out, 0644)

	// Summary
	fmt.Println("\n=== SUMMARY ===")
	allPass := true
	for _, r := range results {
		mark := "✅ PASS"
		if !r.Pass {
			mark = "❌ FAIL"
			allPass = false
		}
		fmt.Printf("  [%s] %s: %s\n", r.Check, mark, r.Action)
	}
	if allPass {
		fmt.Println("\nAll gRPC access path checks PASSED")
	} else {
		fmt.Println("\nSome gRPC access path checks FAILED!")
		os.Exit(1)
	}
}
