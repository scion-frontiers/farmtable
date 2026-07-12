package serverapp

import (
	"net/http"
	"strings"

	grpcweb "github.com/improbable-eng/grpc-web/go/grpcweb"
	"golang.org/x/net/http2"
	"golang.org/x/net/http2/h2c"
	"google.golang.org/grpc"
)

func UnifiedHandler(grpcServer *grpc.Server, assets http.FileSystem) http.Handler {
	wrappedGrpc := grpcweb.WrapServer(grpcServer,
		grpcweb.WithOriginFunc(func(origin string) bool { return true }),
		grpcweb.WithWebsockets(true),
		grpcweb.WithWebsocketOriginFunc(func(req *http.Request) bool { return true }),
	)

	mux := http.NewServeMux()
	mux.HandleFunc("/farmtable.v1/", wrappedGrpc.ServeHTTP)
	mux.HandleFunc("/farmtable.v1.FarmTableService/", wrappedGrpc.ServeHTTP)
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
