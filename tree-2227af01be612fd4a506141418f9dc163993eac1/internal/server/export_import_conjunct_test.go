package server_test

import (
	"context"
	"encoding/json"
	"testing"

	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/store/ent/collection"
	"google.golang.org/grpc/codes"
)

// CONJUNCT A OF THE WRITE-AUTHORIZATION GATE, PINNED BY A TEST THAT SAYS SO IN
// ITS OWN NAME.
//
// The gate is a conjunction across two languages. The GitHub capability set is
// reachable only by a collection object carrying platform GITHUB *and* a
// remote_data map containing writable=true, together, in one object.
//
//	CONJUNCT A (Go, this file):    an imported collection is ALWAYS farmtable.
//	CONJUNCT B (TypeScript):       getCapabilities returns before reading
//	                               remote_data on a farmtable collection.
//	                               Pinned by web/src/capabilities.test.ts.
//
// Import copies an uploaded document's collection remote_data into storage with
// NO KEY VALIDATION, so any caller holding ScopeCollectionAdmin can plant
// "writable": true. That planted key is inert only because conjunct A holds.
// EITHER CONJUNCT MOVING ARMS THE OTHER.
//
// WHY THIS FILE EXISTS RATHER THAN AN ASSERTION ADDED TO AN EXISTING TEST.
// Conjunct A's rejection was already exercised -- by four unnamed lines inside
// TestRPC_ImportExportCollection_Errors, which assert a gRPC code and never
// name the security property. That is coverage in the sense that the code path
// runs, and not coverage in the sense that matters: a test named for error
// handling, asserting FailedPrecondition among four other FailedPreconditions,
// tells a future editor nothing about what breaks if they relax the check. It
// would be deleted or "simplified" by someone who had no way to know. A named
// test is a message to that person. The old assertions are deliberately left
// where they are -- they test the RPC's error contract, which is a different
// thing from the security property, and deleting them would narrow that.

// nonFarmtablePlatforms is written out as values rather than derived, because
// the ent enum exposes no iterable list. Each entry below is the exported
// constant, so removing or renaming a platform is a COMPILE error here rather
// than a silent shrink of the table.
//
// KNOWN GAP, STATED RATHER THAN GLOSSED: adding a NEW platform constant to the
// ent enum does not fail this test. It would simply not be exercised. The
// completeness arm below narrows that -- it proves every value in this table is
// a real enum member, so the table cannot rot in the other direction -- but it
// cannot prove the table is exhaustive. Deliberately NOT closed by asserting a
// count of enum members: a cardinality is a population claim with nothing
// guarding it, which is the defect this round removed from three comment
// blocks, and re-introducing it in a test would be worse than the gap.
var nonFarmtablePlatforms = []collection.Platform{
	collection.PlatformGithub,
	collection.PlatformLinear,
	collection.PlatformJira,
	collection.PlatformAsana,
	collection.PlatformBeads,
}

// plantedRemoteData is the exact payload the gate exists to neutralise. Every
// rejection case below carries it, so the test demonstrates the refusal of the
// dangerous document and not merely of an unusual one.
func plantedRemoteData() map[string]interface{} {
	return map[string]interface{}{"writable": true}
}

func TestConjunctA_ImportRejectsNonFarmtableCollection(t *testing.T) {
	client, _, cleanup := newExportImportTestServer(t)
	defer cleanup()
	ctx := context.Background()

	// Non-enum strings are included on purpose. The guard compares against
	// "farmtable" rather than validating membership, so an unknown or
	// differently-cased value must also be refused; if the guard were ever
	// rewritten as "reject known external platforms" these would arm it.
	type platformCase struct {
		label string
		value string
	}
	cases := []platformCase{
		{"empty string", ""},
		{"unknown platform", "acme-tracker"},
		{"farmtable, wrong case", "FARMTABLE"},
		{"farmtable with whitespace", " farmtable"},
	}
	for _, p := range nonFarmtablePlatforms {
		cases = append(cases, platformCase{"ent enum " + string(p), string(p)})
	}

	rejected := 0
	for _, tc := range cases {
		t.Run(tc.label, func(t *testing.T) {
			doc := minimalImportDoc("planted-"+tc.label, nil, nil, nil, nil, nil)
			coll := doc["collection"].(map[string]interface{})
			coll["platform"] = tc.value
			coll["remote_data"] = plantedRemoteData()

			data, err := json.Marshal(doc)
			if err != nil {
				t.Fatalf("marshalling the import document: %v", err)
			}

			_, err = client.ImportCollection(ctx, &pb.ImportCollectionRequest{Data: data})
			if err == nil {
				t.Fatalf("CONJUNCT A BREACHED: ImportCollection ACCEPTED a document "+
					"declaring platform %q while carrying remote_data %v. An imported "+
					"collection must always be farmtable-platform; this one is not, and it "+
					"arrives carrying the exact key that unlocks GITHUB_CAPABILITIES in "+
					"web/src/capabilities.ts getCapabilities. Conjunct B alone does not "+
					"hold the gate: getCapabilities returns early WITHOUT reading "+
					"remote_data only on a farmtable collection.", tc.value, plantedRemoteData())
			}
			assertCode(t, err, codes.FailedPrecondition)
			rejected++
		})
	}

	if rejected != len(cases) {
		t.Errorf("expected every case to be rejected, got %d of %d", rejected, len(cases))
	}
}

// TestConjunctA_ImportAcceptsFarmtableAndStoresItAsFarmtable is the anti-vacuity
// control for the test above, and it is not optional.
//
// A server that rejected EVERY import -- broken transport, broken decoder, a
// guard accidentally inverted to reject everything -- would make every
// assertion in the rejection test pass. That test alone cannot distinguish "the
// platform guard works" from "import is dead". This one shows the accepting arm
// exists, and additionally pins the OUTCOME rather than the status code: the
// stored collection is farmtable-platform.
func TestConjunctA_ImportAcceptsFarmtableAndStoresItAsFarmtable(t *testing.T) {
	client, s, cleanup := newExportImportTestServer(t)
	defer cleanup()
	ctx := context.Background()

	doc := minimalImportDoc("accepted-control", nil, nil, nil, nil, nil)
	coll := doc["collection"].(map[string]interface{})
	coll["platform"] = string(collection.PlatformFarmtable)
	// The control carries the planted key too. A farmtable collection holding
	// writable=true is exactly the state conjunct B renders harmless, and the
	// import path is allowed to store it -- see the WRITE-AUTHORIZATION GATE
	// block in collectionToProto. If this ever starts failing because the key
	// is rejected, that is a CHANGE OF DESIGN, not a bug in this test.
	coll["remote_data"] = plantedRemoteData()

	data, err := json.Marshal(doc)
	if err != nil {
		t.Fatalf("marshalling the import document: %v", err)
	}

	resp, err := client.ImportCollection(ctx, &pb.ImportCollectionRequest{Data: data})
	if err != nil {
		t.Fatalf("ANTI-VACUITY CONTROL FAILED: a farmtable-platform import was rejected "+
			"(%v). Until this passes, the rejection test above proves nothing: a server "+
			"that refuses every import satisfies it completely.", err)
	}
	if resp.GetCollectionId() == "" {
		t.Fatal("ANTI-VACUITY CONTROL FAILED: import returned no collection id")
	}

	// Pin the outcome, not the status code. The property is about what ends up
	// in storage.
	farmtable := collection.PlatformFarmtable
	stored, _, err := s.ListCollections(ctx, store.ListCollectionsParams{Platform: &farmtable, Limit: 100})
	if err != nil {
		t.Fatalf("ListCollections: %v", err)
	}
	found := false
	for _, c := range stored {
		if c.ID.String() == resp.GetCollectionId() {
			found = true
			if c.Platform != collection.PlatformFarmtable {
				t.Errorf("CONJUNCT A BREACHED IN STORAGE: imported collection %s has platform %q, want %q",
					c.ID, c.Platform, collection.PlatformFarmtable)
			}
		}
	}
	if !found {
		t.Errorf("imported collection %s is not present among the farmtable-platform "+
			"collections in storage; conjunct A is a claim about what is STORED, so this "+
			"lookup failing means the property is unpinned even though the RPC returned OK",
			resp.GetCollectionId())
	}
}
