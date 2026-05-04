package platform

import (
	"context"
	"time"

	"github.com/farmtable-io/farmtable/internal/store/ent"
	"github.com/google/uuid"
)

// Adapter defines the interface for syncing tasks with an external platform.
type Adapter interface {
	Platform() string

	SyncCollection(ctx context.Context, collectionID uuid.UUID, opts SyncOptions) (SyncResult, error)

	PushTask(ctx context.Context, task *ent.Task) (remoteID string, err error)

	PushComment(ctx context.Context, comment *ent.Comment, task *ent.Task) (remoteID string, err error)
}

type SyncOptions struct {
	FullSync bool
	Since    *time.Time
}

type SyncResult struct {
	Created int
	Updated int
	Errors  int
}
