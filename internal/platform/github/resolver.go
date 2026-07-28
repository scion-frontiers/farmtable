package github

import (
	"fmt"

	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/store/ent/collection"
	"github.com/google/uuid"
)

// NewPlatformResolver returns a store.PlatformResolver that handles
// GitHub collections. For any other platform it returns (nil, nil) to
// signal that lazy registration is not supported.
//
// cfg is the operator's GitHub configuration and is threaded through to every
// store this resolver builds. It USED to be hardcoded nil here, which meant a
// deployed server always ran DefaultConfig() no matter what the operator had
// written: github.LoadConfig is reached from the CLI only, so nothing in the
// server binary ever read the file (#194 round 7, M-1).
//
// That is a security defect and not just a missing feature. Since B6 the
// configured push_prefix decides which labels may feed an authorization or
// terminal-stage determination. An operator who customised their prefix had the
// round-6 label-write gate silently DISARMED — it did not recognise their
// labels as lifecycle labels at all — while the dashboard and the release notes
// told them the control was on. A gate that is off for exactly the operators
// who customised something is worse than no gate, because it manufactures
// confidence.
//
// A nil cfg is still accepted and still means DefaultConfig(), which is what
// NewPassThroughStore does with it. The difference is that nil is now something
// a caller has to ask for.
func NewPlatformResolver(cfg *GitHubConfig) store.PlatformResolver {
	return func(platform collection.Platform, token string, remoteID string, collectionID uuid.UUID) (store.Store, error) {
		if platform != collection.PlatformGithub {
			return nil, nil // unsupported — fall through to primary
		}

		owner, repo, ok := store.ParseOwnerRepo(remoteID)
		if !ok {
			return nil, fmt.Errorf("invalid github RemoteID %q: expected owner/repo", remoteID)
		}

		cid := collectionID
		return NewPassThroughStore(token, owner, repo, cfg, &cid), nil
	}
}
