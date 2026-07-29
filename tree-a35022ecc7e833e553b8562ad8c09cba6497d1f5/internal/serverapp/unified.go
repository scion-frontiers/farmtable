package serverapp

import (
	"log"
	"net/http"
	"strings"

	grpcweb "github.com/improbable-eng/grpc-web/go/grpcweb"
	"golang.org/x/net/http2"
	"golang.org/x/net/http2/h2c"
	"google.golang.org/grpc"

	"github.com/farmtable-io/farmtable/internal/server"
	"github.com/farmtable-io/farmtable/internal/store"
)

// UnifiedHandlerOptions configures optional features of the unified HTTP handler.
type UnifiedHandlerOptions struct {
	// TokenLookup enables session-based authentication for the web dashboard.
	// When set, /api/auth/session endpoints are registered and the
	// session-to-bearer middleware is applied to gRPC-web requests.
	TokenLookup server.TokenLookup

	// Store provides database access for auth provisioning and link flows.
	Store store.Store

	// AuthMode determines how the server authenticates users.
	// Defaults to AuthModeToken (existing behavior).
	AuthMode AuthMode

	// IAPAudience is the expected audience for IAP JWT verification.
	// Required when AuthMode is AuthModeProxy.
	IAPAudience string

	// AllowedDomains is a comma-separated list of email domains allowed
	// for user provisioning (e.g. "example.com,corp.dev"). Empty allows all.
	AllowedDomains string

	// BaseURL is the externally reachable base URL (e.g. "https://app.farmtable.io").
	// Required for link flow OAuth callbacks.
	BaseURL string
}

func UnifiedHandler(grpcServer *grpc.Server, assets http.FileSystem, opts ...UnifiedHandlerOptions) http.Handler {
	wrappedGrpc := grpcweb.WrapServer(grpcServer,
		grpcweb.WithOriginFunc(func(origin string) bool { return true }),
		grpcweb.WithWebsockets(true),
		grpcweb.WithWebsocketOriginFunc(func(req *http.Request) bool { return true }),
	)

	var grpcWebHandler http.Handler = wrappedGrpc

	mux := http.NewServeMux()

	var o UnifiedHandlerOptions
	if len(opts) > 0 {
		o = opts[0]
	}

	// Apply session management if a TokenLookup is provided.
	var sm *SessionManager
	if o.TokenLookup != nil {
		sm = NewSessionManager(o.TokenLookup)
		sm.RegisterRoutes(mux)
		// Wrap the gRPC-web handler with session-to-bearer middleware so
		// browser requests with a session cookie are authenticated.
		grpcWebHandler = sm.SessionToBearerMiddleware(wrappedGrpc)
	}

	// Wire auth mode-specific components.
	switch o.AuthMode {
	case AuthModeOAuth:
		if o.Store != nil && sm != nil {
			provisioner := NewUserProvisioner(o.Store, o.AllowedDomains)
			oauthCfg := GoogleOAuthConfigFromEnv(o.BaseURL)
			oauthMgr := NewGoogleOAuthManager(oauthCfg, sm.SessionStore(), provisioner)
			oauthMgr.RegisterRoutes(mux)
			log.Println("OAuth login enabled")
		}

	case AuthModeProxy:
		if o.Store != nil {
			provisioner := NewUserProvisioner(o.Store, o.AllowedDomains)
			iapAuth := &IAPAuthenticator{Audience: o.IAPAudience}

			// Wrap the mux with IAP middleware that verifies the JWT and
			// provisions users into a session for downstream handlers.
			grpcWebHandler = iapMiddleware(iapAuth, provisioner, sm, grpcWebHandler)
			log.Println("IAP proxy auth enabled")
		}
	}

	// Wire link flow routes when Store and BaseURL are available.
	if o.Store != nil && o.BaseURL != "" {
		linkMgr := NewLinkFlowManager(o.Store, o.BaseURL)
		linkMgr.RegisterRoutes(mux)
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

// iapMiddleware wraps an HTTP handler to verify IAP JWT assertions and provision
// users. When a valid IAP assertion is present, the user is provisioned and a
// session is created. When no assertion is present, the request passes through
// (allowing token auth via gRPC interceptors).
func iapMiddleware(iap *IAPAuthenticator, provisioner *UserProvisioner, sm *SessionManager, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		info, err := iap.Authenticate(r)
		if err != nil {
			log.Printf("IAP auth error: %v", err)
			http.Error(w, "IAP authentication failed", http.StatusUnauthorized)
			return
		}
		if info == nil {
			// No IAP assertion — fall through to token auth.
			next.ServeHTTP(w, r)
			return
		}

		// Provision user from IAP identity.
		result, err := provisioner.FindOrCreateByEmail(r.Context(), info.Email, info.Email)
		if err != nil {
			log.Printf("IAP user provisioning error: %v", err)
			http.Error(w, "user provisioning failed", http.StatusInternalServerError)
			return
		}

		// If we have a session manager, create a session for the provisioned user.
		if sm != nil {
			sess, err := sm.SessionStore().Get(r, sessionCookieName)
			if err != nil {
				sess, _ = sm.SessionStore().New(r, sessionCookieName)
			}
			sess.Values[sessKeyUserID] = result.User.ID.String()
			sess.Values[sessKeyUserName] = result.User.DisplayName
			sess.Values[sessKeyUserEmail] = info.Email
			sess.Values[sessKeyUserType] = result.User.Type

			// Bridge IAP session to gRPC auth: create a short-lived API token so
			// SessionToBearerMiddleware can inject a Bearer header for gRPC requests.
			// Reuse the existing session token if one is already set — the IAP
			// middleware runs on every request, so without this guard each request
			// would mint a new token row and orphan the previous one.
			if _, hasToken := sess.Values[sessKeyToken].(string); !hasToken {
				if rawToken, err := provisioner.CreateSessionToken(r.Context(), result.User.ID, result.User.Type); err == nil {
					sess.Values[sessKeyToken] = rawToken
				} else {
					log.Printf("failed to create session token for IAP user %s: %v", result.User.ID, err)
				}
			}

			sess.Options.Secure = isSecureRequest(r)
			if err := sess.Save(r, w); err != nil {
				log.Printf("IAP session save error: %v", err)
			}
		}

		next.ServeHTTP(w, r)
	})
}
