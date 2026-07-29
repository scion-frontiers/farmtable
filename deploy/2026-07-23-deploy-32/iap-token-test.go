// Live IAP+x-farmtable-token validation test for deploy-32.
// Tests that the NEWLY DEPLOYED revision (farmtable-00038-gmg) correctly reads
// the x-farmtable-token gRPC metadata header for authentication when behind IAP.
package main

import (
	"context"
	"crypto/tls"
	"fmt"
	"os"
	"strings"
	"time"

	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/metadata"
)

func main() {
	iapToken := os.Getenv("IAP_TOKEN")
	ftToken := os.Getenv("FT_TOKEN")
	server := "farmtable-486315127503.us-central1.run.app:443"

	if iapToken == "" || ftToken == "" {
		fmt.Fprintln(os.Stderr, "Set IAP_TOKEN and FT_TOKEN env vars")
		os.Exit(1)
	}

	conn, err := grpc.NewClient(server,
		grpc.WithTransportCredentials(credentials.NewTLS(&tls.Config{})),
	)
	if err != nil {
		fmt.Fprintf(os.Stderr, "dial error: %v\n", err)
		os.Exit(1)
	}
	defer conn.Close()

	client := pb.NewFarmTableServiceClient(conn)

	fmt.Println("=== Deploy-32 Live IAP + x-farmtable-token Validation ===")
	fmt.Printf("Server: %s\n", server)
	fmt.Printf("Time: %s\n\n", time.Now().UTC().Format(time.RFC3339))

	// ---------------------------------------------------------------
	// TEST 1: IAP token in Authorization ONLY (no x-farmtable-token)
	// Expected: passes IAP but app sees IAP JWT, NOT farmtable token -> unauthenticated
	// ---------------------------------------------------------------
	fmt.Println("--- TEST 1: Authorization-only (IAP token, no x-farmtable-token) ---")
	ctx1 := metadata.NewOutgoingContext(context.Background(), metadata.Pairs(
		"authorization", "Bearer "+iapToken,
	))
	resp1, err1 := client.GetVersion(ctx1, &pb.GetVersionRequest{})
	if err1 != nil {
		fmt.Printf("GetVersion: ERROR — %v\n", err1)
	} else {
		fmt.Printf("GetVersion: OK — server_version=%q\n", resp1.GetServerVersion())
	}
	// Try listing collections with IAP-only auth — server does unauthenticated pass-through
	listResp1, listErr1 := client.ListCollections(ctx1, &pb.ListCollectionsRequest{})
	if listErr1 != nil {
		fmt.Printf("ListCollections: ERROR — %v\n", listErr1)
	} else {
		fmt.Printf("ListCollections: OK — %d collections (unauthenticated pass-through)\n", len(listResp1.GetItems()))
	}
	fmt.Println()

	// ---------------------------------------------------------------
	// TEST 2: IAP token in Authorization + farmtable token in x-farmtable-token
	// Expected: passes IAP AND app authenticates via x-farmtable-token -> authenticated
	// ---------------------------------------------------------------
	fmt.Println("--- TEST 2: Authorization + x-farmtable-token (BOTH headers) ---")
	ctx2 := metadata.NewOutgoingContext(context.Background(), metadata.Pairs(
		"authorization", "Bearer "+iapToken,
		"x-farmtable-token", ftToken,
	))
	resp2, err2 := client.GetVersion(ctx2, &pb.GetVersionRequest{})
	if err2 != nil {
		fmt.Printf("GetVersion: ERROR — %v\n", err2)
	} else {
		fmt.Printf("GetVersion: OK (AUTHENTICATED via x-farmtable-token) — server_version=%q\n", resp2.GetServerVersion())
	}
	listResp2, listErr2 := client.ListCollections(ctx2, &pb.ListCollectionsRequest{})
	if listErr2 != nil {
		fmt.Printf("ListCollections: ERROR — %v\n", listErr2)
	} else {
		fmt.Printf("ListCollections: OK — %d collections\n", len(listResp2.GetItems()))
		for _, c := range listResp2.GetItems() {
			fmt.Printf("  - %s (id: %s)\n", c.GetName(), c.GetId())
		}
	}
	fmt.Println()

	// ---------------------------------------------------------------
	// TEST 3: farmtable token in Authorization ONLY (old-style, no IAP token)
	// Expected: IAP REJECTS the request because the ft_ token is not a valid OIDC token
	// ---------------------------------------------------------------
	fmt.Println("--- TEST 3: Authorization with ft_ token ONLY (old-style, no IAP bypass) ---")
	ctx3 := metadata.NewOutgoingContext(context.Background(), metadata.Pairs(
		"authorization", "Bearer "+ftToken,
	))
	_, err3 := client.GetVersion(ctx3, &pb.GetVersionRequest{})
	if err3 != nil {
		errStr := err3.Error()
		if strings.Contains(errStr, "Unauthenticated") || strings.Contains(errStr, "IAP") || strings.Contains(errStr, "401") || strings.Contains(errStr, "403") || strings.Contains(errStr, "16") {
			fmt.Printf("Result: BLOCKED by IAP as expected — %v\n", err3)
		} else {
			fmt.Printf("Result: ERROR (unexpected) — %v\n", err3)
		}
	} else {
		fmt.Println("Result: UNEXPECTED OK (IAP should have blocked this!)")
	}
	fmt.Println()

	// ---------------------------------------------------------------
	// TEST 4: x-farmtable-token ONLY (no Authorization header at all)
	// Expected: IAP REJECTS — no valid OIDC token in Authorization header
	// ---------------------------------------------------------------
	fmt.Println("--- TEST 4: x-farmtable-token ONLY (no Authorization header) ---")
	ctx4 := metadata.NewOutgoingContext(context.Background(), metadata.Pairs(
		"x-farmtable-token", ftToken,
	))
	_, err4 := client.GetVersion(ctx4, &pb.GetVersionRequest{})
	if err4 != nil {
		errStr := err4.Error()
		if strings.Contains(errStr, "Unauthenticated") || strings.Contains(errStr, "IAP") || strings.Contains(errStr, "401") || strings.Contains(errStr, "403") || strings.Contains(errStr, "16") {
			fmt.Printf("Result: BLOCKED by IAP as expected — %v\n", err4)
		} else {
			fmt.Printf("Result: ERROR (unexpected) — %v\n", err4)
		}
	} else {
		fmt.Println("Result: UNEXPECTED OK (IAP should have blocked this!)")
	}
	fmt.Println()

	// ---------------------------------------------------------------
	// SUMMARY
	// ---------------------------------------------------------------
	fmt.Println("=== SUMMARY ===")
	fmt.Println("TEST 1 (IAP-only auth):            Should show unauthenticated pass-through")
	fmt.Println("TEST 2 (IAP + x-farmtable-token):  Should show AUTHENTICATED + list collections")
	fmt.Println("TEST 3 (ft_ token in Authorization): Should be BLOCKED by IAP")
	fmt.Println("TEST 4 (x-farmtable-token only):    Should be BLOCKED by IAP")
	fmt.Println()
	fmt.Println("If TEST 2 shows authenticated and TEST 3/4 are blocked,")
	fmt.Println("the x-farmtable-token header is the ONLY viable auth path through IAP.")
}
