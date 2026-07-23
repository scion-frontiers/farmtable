package decomposer

import (
	"context"
	"crypto/tls"
	"fmt"
	"net"
	"os"
	"strings"

	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
)

// TaskWriter handles Farmtable gRPC task creation and relationship wiring.
type TaskWriter interface {
	CreateTask(ctx context.Context, name, description, parentTaskID string, blockedByIDs []string) (string, error)
	ResolveCollection(ctx context.Context, collectionFlag string) (string, error)
	CreateCollection(ctx context.Context, name string) (string, error)
}

// GRPCWriter implements TaskWriter using the Farmtable gRPC client.
type GRPCWriter struct {
	client       pb.FarmTableServiceClient
	conn         *grpc.ClientConn
	collectionID string
	token        string
}

// NewGRPCWriter creates a new GRPCWriter connected to the given server.
func NewGRPCWriter(server, token string) (*GRPCWriter, error) {
	if server == "" {
		server = os.Getenv("FARMTABLE_SERVER")
	}
	if server == "" {
		return nil, fmt.Errorf("no server address: set --server or FARMTABLE_SERVER")
	}

	if token == "" {
		token = os.Getenv("FARMTABLE_TOKEN")
	}
	if token == "" {
		return nil, fmt.Errorf("no auth token: set --token or FARMTABLE_TOKEN")
	}

	var creds grpc.DialOption
	if isLocalhost(server) {
		creds = grpc.WithTransportCredentials(insecure.NewCredentials())
	} else {
		creds = grpc.WithTransportCredentials(credentials.NewTLS(&tls.Config{}))
	}

	conn, err := grpc.NewClient(server, creds)
	if err != nil {
		return nil, fmt.Errorf("dialing server: %w", err)
	}

	return &GRPCWriter{
		client: pb.NewFarmTableServiceClient(conn),
		conn:   conn,
		token:  token,
	}, nil
}

func (w *GRPCWriter) authCtx(ctx context.Context) context.Context {
	md := metadata.Pairs(
		"authorization", "Bearer "+w.token,
		"x-farmtable-token", w.token,
	)
	return metadata.NewOutgoingContext(ctx, md)
}

// SetCollectionID sets the collection ID for all subsequent CreateTask calls.
func (w *GRPCWriter) SetCollectionID(id string) {
	w.collectionID = id
}

// CreateTask creates a task on Farmtable with the given properties.
// Returns the created task's ID.
func (w *GRPCWriter) CreateTask(ctx context.Context, name, description, parentTaskID string, blockedByIDs []string) (string, error) {
	ctx = w.authCtx(ctx)

	stage := pb.TaskStage_TASK_STAGE_TRIAGE
	req := &pb.CreateTaskRequest{
		Name:         name,
		CollectionId: w.collectionID,
		Description:  &description,
		Stage:        &stage,
	}
	if parentTaskID != "" {
		req.ParentTaskId = &parentTaskID
	}
	if len(blockedByIDs) > 0 {
		req.BlockedByTaskIds = blockedByIDs
	}

	task, err := w.client.CreateTask(ctx, req)
	if err != nil {
		return "", fmt.Errorf("creating task %q: %w", name, err)
	}
	return task.GetId(), nil
}

// ResolveCollection resolves a collection flag value to a collection ID.
// If the value looks like a UUID, it's returned as-is. Otherwise, it's
// treated as a name and looked up via ListCollections.
func (w *GRPCWriter) ResolveCollection(ctx context.Context, collectionFlag string) (string, error) {
	ctx = w.authCtx(ctx)

	// If it looks like a UUID, use it directly.
	if isUUID(collectionFlag) {
		w.collectionID = collectionFlag
		return collectionFlag, nil
	}

	// Otherwise search by name, paginating through all collections.
	var pageToken string
	for {
		resp, err := w.client.ListCollections(ctx, &pb.ListCollectionsRequest{
			PageSize:  100,
			PageToken: pageToken,
		})
		if err != nil {
			return "", fmt.Errorf("listing collections: %w", err)
		}
		for _, c := range resp.GetItems() {
			if strings.EqualFold(c.GetName(), collectionFlag) {
				w.collectionID = c.GetId()
				return c.GetId(), nil
			}
		}
		pageToken = resp.GetNextPageToken()
		if pageToken == "" {
			break
		}
	}

	return "", fmt.Errorf("collection %q not found", collectionFlag)
}

// CreateCollection creates a new collection on Farmtable.
// Returns the new collection's ID.
func (w *GRPCWriter) CreateCollection(ctx context.Context, name string) (string, error) {
	ctx = w.authCtx(ctx)

	col, err := w.client.CreateCollection(ctx, &pb.CreateCollectionRequest{
		Name: name,
	})
	if err != nil {
		return "", fmt.Errorf("creating collection %q: %w", name, err)
	}

	w.collectionID = col.GetId()
	return col.GetId(), nil
}

// Close closes the underlying gRPC connection.
func (w *GRPCWriter) Close() error {
	if w.conn != nil {
		return w.conn.Close()
	}
	return nil
}

func isLocalhost(addr string) bool {
	host := addr
	if splitHost, _, err := net.SplitHostPort(addr); err == nil {
		host = splitHost
	}
	host = strings.Trim(host, "[]")
	return host == "localhost" || host == "127.0.0.1" || host == "::1" || host == ""
}

func isUUID(s string) bool {
	// Simple heuristic: UUIDs are 36 chars with dashes at positions 8, 13, 18, 23.
	if len(s) != 36 {
		return false
	}
	for i, c := range s {
		if i == 8 || i == 13 || i == 18 || i == 23 {
			if c != '-' {
				return false
			}
		} else {
			if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')) {
				return false
			}
		}
	}
	return true
}
