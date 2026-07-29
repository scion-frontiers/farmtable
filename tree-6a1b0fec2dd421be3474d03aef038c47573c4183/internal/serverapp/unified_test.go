package serverapp

import (
	"context"
	"io"
	"net"
	"net/http"
	"strings"
	"testing"
	"testing/fstest"

	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

type testFarmTableService struct {
	pb.UnimplementedFarmTableServiceServer
}

func (testFarmTableService) GetVersion(context.Context, *pb.GetVersionRequest) (*pb.GetVersionResponse, error) {
	return &pb.GetVersionResponse{
		ServerVersion: "unified-test",
		ApiProtocol:   "grpc",
	}, nil
}

func TestUnifiedHandlerServesStaticAssets(t *testing.T) {
	grpcServer := grpc.NewServer()
	pb.RegisterFarmTableServiceServer(grpcServer, testFarmTableService{})

	handler := UnifiedHandler(grpcServer, http.FS(fstest.MapFS{
		"index.html": {Data: []byte("<!doctype html><title>Farm Table</title>")},
	}))

	req := mustRequest(t, http.MethodGet, "/", nil)
	resp := mustDo(t, handler, req)
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want %d", resp.StatusCode, http.StatusOK)
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("read response body: %v", err)
	}
	if !strings.Contains(string(body), "Farm Table") {
		t.Fatalf("body = %q, want dashboard HTML", body)
	}
}

func TestUnifiedHandlerServesNativeGRPC(t *testing.T) {
	grpcServer := grpc.NewServer()
	pb.RegisterFarmTableServiceServer(grpcServer, testFarmTableService{})

	httpServer, addr := startHTTPServer(t, UnifiedHandler(grpcServer, http.FS(fstest.MapFS{})))
	defer httpServer.Close()

	conn, err := grpc.NewClient(addr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		t.Fatalf("dial unified server: %v", err)
	}
	defer conn.Close()

	resp, err := pb.NewFarmTableServiceClient(conn).GetVersion(context.Background(), &pb.GetVersionRequest{})
	if err != nil {
		t.Fatalf("GetVersion: %v", err)
	}
	if resp.GetServerVersion() != "unified-test" {
		t.Fatalf("server version = %q, want unified-test", resp.GetServerVersion())
	}
}

func startHTTPServer(t *testing.T, handler http.Handler) (*http.Server, string) {
	t.Helper()

	lis, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	server := &http.Server{Handler: handler}
	go func() {
		if err := server.Serve(lis); err != nil && err != http.ErrServerClosed {
			t.Errorf("HTTP server: %v", err)
		}
	}()
	return server, lis.Addr().String()
}

func mustRequest(t *testing.T, method string, path string, body io.Reader) *http.Request {
	t.Helper()
	req, err := http.NewRequest(method, path, body)
	if err != nil {
		t.Fatalf("new request: %v", err)
	}
	return req
}

func mustDo(t *testing.T, handler http.Handler, req *http.Request) *http.Response {
	t.Helper()
	rec := responseRecorder{header: make(http.Header)}
	handler.ServeHTTP(&rec, req)
	return rec.Result()
}

type responseRecorder struct {
	header http.Header
	body   strings.Builder
	code   int
}

func (r *responseRecorder) Header() http.Header {
	return r.header
}

func (r *responseRecorder) Write(data []byte) (int, error) {
	if r.code == 0 {
		r.code = http.StatusOK
	}
	return r.body.Write(data)
}

func (r *responseRecorder) WriteHeader(statusCode int) {
	r.code = statusCode
}

func (r *responseRecorder) Result() *http.Response {
	if r.code == 0 {
		r.code = http.StatusOK
	}
	return &http.Response{
		StatusCode: r.code,
		Header:     r.header,
		Body:       io.NopCloser(strings.NewReader(r.body.String())),
	}
}
