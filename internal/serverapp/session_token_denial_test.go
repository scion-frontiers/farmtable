package serverapp

import (
	"context"
	"strings"
	"testing"

	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/store/ent"
	"github.com/google/uuid"
)

// shippedUserTypes is spelled out literally rather than read from
// server.KnownUserTypes() so this file compiles against the unfixed tree and
// the RED evidence is behavioural rather than a compile error.
var shippedUserTypes = []string{
	"admin", "agent", "human", "orchestrator", "reviewer", "service_account", "viewer",
}

// sessionTokenStore records the tokens CreateSessionToken asks it to mint, so a
// test can assert not just what was returned but whether anything was written.
type sessionTokenStore struct {
	store.Store
	minted []store.CreateAPITokenParams
}

func (m *sessionTokenStore) CreateAPIToken(_ context.Context, p store.CreateAPITokenParams) (*ent.ApiToken, string, error) {
	m.minted = append(m.minted, p)
	return &ent.ApiToken{ID: uuid.New()}, "ft_test_token", nil
}

// TestDenySessionTokenForUnrecognisedUserType is the R4 oracle, and it covers
// the widest route to a bad token: this path is reachable by anyone who can
// complete an OAuth or IAP login, with no operator in the loop.
//
// Against unfixed code CreateSessionToken mints a token carrying no scopes for
// an unrecognised type. Before the empty-grants-nothing rule that token was a
// silent wildcard; after it, the token is silently dead. Both are wrong, and
// neither is visible at the moment of minting — which is why the refusal has
// to happen here rather than at first use.
func TestDenySessionTokenForUnrecognisedUserType(t *testing.T) {
	for _, ut := range []string{"reviewr", "superuser", ""} {
		t.Run("type="+ut, func(t *testing.T) {
			st := &sessionTokenStore{}
			p := &UserProvisioner{store: st}

			tok, err := p.CreateSessionToken(context.Background(), uuid.New(), ut)
			if err == nil {
				t.Fatalf("CreateSessionToken minted %q for unrecognised type %q; "+
					"an unrecognised type has no permission set, so no token can be issued", tok, ut)
			}
			if tok != "" {
				t.Errorf("a refused mint must return no token, got %q", tok)
			}
			if len(st.minted) != 0 {
				t.Errorf("a refused mint must not write a token row, got %d: %+v", len(st.minted), st.minted)
			}

			// Criterion (d): the failure must say why, and name the vocabulary,
			// or an operator sees only "login failed". The typed-error contract
			// itself is asserted at its source, in the internal/server oracle.
			if msg := err.Error(); !strings.Contains(msg, "agent") {
				t.Errorf("refusal should name the recognised types; got: %s", msg)
			}
		})
	}
}

// TestAllowSessionTokenForRecognisedUserTypes is the Item D guard on this path.
// Every recognised type must still get a session token, and that token must
// carry a NON-EMPTY scope set — an empty one would now be a dead login.
func TestAllowSessionTokenForRecognisedUserTypes(t *testing.T) {
	for _, ut := range shippedUserTypes {
		t.Run(ut, func(t *testing.T) {
			st := &sessionTokenStore{}
			p := &UserProvisioner{store: st}

			tok, err := p.CreateSessionToken(context.Background(), uuid.New(), ut)
			if err != nil {
				t.Fatalf("recognised type %q must still get a session token, got: %v", ut, err)
			}
			if tok == "" {
				t.Fatal("expected a token")
			}
			if len(st.minted) != 1 {
				t.Fatalf("expected exactly one token row, got %d", len(st.minted))
			}
			// The load-bearing assertion for Item D: a legitimate OAuth login
			// must not produce a token that grants nothing.
			if len(st.minted[0].Scopes) == 0 {
				t.Fatalf("session token for recognised type %q was minted with no scopes; "+
					"under the empty-grants-nothing rule that is a login that can do nothing", ut)
			}
			if st.minted[0].ExpiresAt == nil {
				t.Error("session token must stay time-limited")
			}
		})
	}
}

// TestAllowOAuthProvisionedUserGetsWorkingToken joins the two halves of the
// OAuth path: the type FindOrCreateByEmail actually assigns must be a type
// CreateSessionToken will accept. If provisioning ever starts writing a type
// the scope table does not know, every new login becomes a dead account, and
// this test is what catches it.
func TestAllowOAuthProvisionedUserGetsWorkingToken(t *testing.T) {
	st := &sessionTokenStore{}
	prov := &mockProvisioningStore{}
	p := &UserProvisioner{store: prov}

	res, err := p.FindOrCreateByEmail(context.Background(), "newcomer@example.com", "")
	if err != nil {
		t.Fatalf("provisioning a new user: %v", err)
	}
	if !res.Created {
		t.Fatal("expected a newly created user")
	}

	var recognised bool
	for _, ut := range shippedUserTypes {
		if res.User.Type == ut {
			recognised = true
		}
	}
	if !recognised {
		t.Fatalf("FindOrCreateByEmail assigned type %q, which is not in the shipped "+
			"vocabulary %v; every new OAuth login would be a dead account",
			res.User.Type, shippedUserTypes)
	}

	p2 := &UserProvisioner{store: st}
	if _, err := p2.CreateSessionToken(context.Background(), res.User.ID, res.User.Type); err != nil {
		t.Fatalf("a freshly provisioned user must be able to get a session token, got: %v", err)
	}
	if len(st.minted) != 1 || len(st.minted[0].Scopes) == 0 {
		t.Fatal("a freshly provisioned user's session token must carry scopes")
	}
}
