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
func NewPlatformResolver() store.PlatformResolver {
	return func(platform collection.Platform, token string, remoteID string, collectionID uuid.UUID) (store.Store, error) {
		if platform != collection.PlatformGithub {
			return nil, nil // unsupported — fall through to primary
		}

		owner, repo, ok := store.ParseOwnerRepo(remoteID)
		if !ok {
			return nil, fmt.Errorf("invalid github RemoteID %q: expected owner/repo", remoteID)
		}

		cid := collectionID
		return NewPassThroughStore(token, owner, repo, nil, &cid), nil
	}
}
