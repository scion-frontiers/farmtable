package serverapp

import (
	"net/http"
	"strings"

	grpcweb "github.com/improbable-eng/grpc-web/go/grpcweb"
	"golang.org/x/net/http2"
	"golang.org/x/net/http2/h2c"
	"google.golang.org/grpc"

	"github.com/farmtable-io/farmtable/internal/server"
)

// UnifiedHandlerOptions configures optional features of the unified HTTP handler.
type UnifiedHandlerOptions struct {
	// TokenLookup enables session-based authentication for the web dashboard.
	// When set, /api/auth/session endpoints are registered and the
	// session-to-bearer middleware is applied to gRPC-web requests.
	TokenLookup server.TokenLookup
}

func UnifiedHandler(grpcServer *grpc.Server, assets http.FileSystem, opts ...UnifiedHandlerOptions) http.Handler {
	wrappedGrpc := grpcweb.WrapServer(grpcServer,
		grpcweb.WithOriginFunc(func(origin string) bool { return true }),
		grpcweb.WithWebsockets(true),
		grpcweb.WithWebsocketOriginFunc(func(req *http.Request) bool { return true }),
	)

	var grpcWebHandler http.Handler = wrappedGrpc

	mux := http.NewServeMux()

	// Apply session management if a TokenLookup is provided.
	if len(opts) > 0 && opts[0].TokenLookup != nil {
		sm := NewSessionManager(opts[0].TokenLookup)
		sm.RegisterRoutes(mux)
		// Wrap the gRPC-web handler with session-to-bearer middleware so
		// browser requests with a session cookie are authenticated.
		grpcWebHandler = sm.SessionToBearerMiddleware(wrappedGrpc)
	}

	mux.Handle("/farmtable.v1/", grpcWebHandler)
	mux.Handle("/farmtable.v1.FarmTableService/", grpcWebHandler)
	mux.Handle("/", http.FileServer(assets))

	return h2c.NewHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		contentType := r.Header.Get("Content-Type")
		if r.ProtoMajor == 2 &&
			strings.HasPrefix(contentType, "application/grpc") &&
			!strings.HasPrefix(contentType, "application/grpc-web") {
			grpcServer.ServeHTTP(w, r)
			return
		}
		mux.ServeHTTP(w, r)
	}), &http2.Server{})
}
