package cli

import (
	"encoding/json"
	"fmt"
	"os"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

const (
	ExitSuccess       = 0
	ExitGeneral       = 1
	ExitUsage         = 2
	ExitAuth          = 3
	ExitNotFound      = 4
	ExitConflict      = 5
	ExitValidation    = 6
	ExitPermission    = 7
	ExitServerUnavail = 8
	ExitPlatform      = 9
)

func grpcExitCode(err error) int {
	st, ok := status.FromError(err)
	if !ok {
		return ExitGeneral
	}
	switch st.Code() {
	case codes.Unauthenticated:
		return ExitAuth
	case codes.NotFound:
		return ExitNotFound
	case codes.FailedPrecondition, codes.Aborted, codes.AlreadyExists:
		return ExitConflict
	case codes.InvalidArgument:
		return ExitValidation
	case codes.PermissionDenied:
		return ExitPermission
	case codes.Unavailable:
		return ExitServerUnavail
	default:
		return ExitGeneral
	}
}

func grpcErrorCode(err error) string {
	st, ok := status.FromError(err)
	if !ok {
		return "INTERNAL_ERROR"
	}
	switch st.Code() {
	case codes.Unauthenticated:
		return "AUTH_REQUIRED"
	case codes.NotFound:
		return "NOT_FOUND"
	case codes.FailedPrecondition, codes.Aborted:
		return "CONFLICT"
	case codes.AlreadyExists:
		return "ALREADY_CLAIMED"
	case codes.InvalidArgument:
		return "VALIDATION_ERROR"
	case codes.PermissionDenied:
		return "PERMISSION_DENIED"
	case codes.Unavailable:
		return "SERVER_UNAVAILABLE"
	default:
		return "INTERNAL_ERROR"
	}
}

func handleGRPCError(err error) {
	code := grpcExitCode(err)
	errCode := grpcErrorCode(err)
	st, _ := status.FromError(err)

	errObj := map[string]interface{}{
		"error": map[string]interface{}{
			"code":    errCode,
			"message": st.Message(),
		},
	}
	data, _ := json.MarshalIndent(errObj, "", "  ")
	fmt.Fprintln(os.Stdout, string(data))
	fmt.Fprintf(os.Stderr, "Error: %s\n", st.Message())
	os.Exit(code)
}

func exitError(code int, errCode, message string) {
	errObj := map[string]interface{}{
		"error": map[string]interface{}{
			"code":    errCode,
			"message": message,
		},
	}
	data, _ := json.MarshalIndent(errObj, "", "  ")
	fmt.Fprintln(os.Stdout, string(data))
	fmt.Fprintf(os.Stderr, "Error: %s\n", message)
	os.Exit(code)
}

func requireToken(token string) {
	if token == "" {
		exitError(ExitAuth, "AUTH_REQUIRED", "No API token found. Set FARMTABLE_TOKEN, use --token, or configure token in config file.")
	}
}
