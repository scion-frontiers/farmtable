package serverapp

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/go-jose/go-jose/v4"
	"github.com/go-jose/go-jose/v4/jwt"
)

const (
	// IAPAssertionHeader is the header containing the IAP signed JWT.
	IAPAssertionHeader = "X-Goog-IAP-JWT-Assertion"

	// DefaultIAPIssuer is the expected issuer for IAP JWTs.
	DefaultIAPIssuer = "https://cloud.google.com/iap"

	// DefaultIAPJWKSURL is the URL for IAP public keys.
	DefaultIAPJWKSURL = "https://www.gstatic.com/iap/verify/public_key-jwk"

	// iapClockSkew is the allowed clock skew for exp/iat validation.
	iapClockSkew = 30 * time.Second

	// jwksRefreshInterval is how often the JWKS cache proactively refreshes.
	jwksRefreshInterval = 1 * time.Hour

	// iapIdPPrefix is the IdP prefix stripped from IAP sub/email claims.
	iapIdPPrefix = "accounts.google.com:"
)

// IAPUserInfo is the verified identity extracted from IAP JWT assertions.
type IAPUserInfo struct {
	Subject string // stable provider subject (IdP prefix stripped)
	Email   string // verified email (lowercased, IdP prefix stripped)
	Domain  string // hd claim, if present
}

// IAPAuthenticator verifies Google IAP signed JWTs from the
// X-Goog-IAP-JWT-Assertion header.
type IAPAuthenticator struct {
	// Audience is the expected audience claim — MANDATORY.
	Audience string

	// Issuer overrides the expected issuer (defaults to DefaultIAPIssuer).
	Issuer string

	// JWKSURL overrides the JWKS endpoint (defaults to DefaultIAPJWKSURL).
	JWKSURL string

	// HTTPClient overrides the HTTP client for fetching JWKS.
	HTTPClient *http.Client

	// NowFunc overrides time.Now for testing.
	NowFunc func() time.Time

	jwksCache *iapJWKSCache
	initOnce  sync.Once
}

// Authenticate reads the IAP assertion header, verifies the JWT, and returns
// the verified IAPUserInfo. Returns (nil, nil) if no assertion is present.
func (a *IAPAuthenticator) Authenticate(r *http.Request) (*IAPUserInfo, error) {
	a.initOnce.Do(a.init)

	assertion := r.Header.Get(IAPAssertionHeader)
	if assertion == "" {
		return nil, nil // no assertion present — fall through
	}

	// Parse the JWT (compact serialization, ES256 only).
	tok, err := jwt.ParseSigned(assertion, []jose.SignatureAlgorithm{jose.ES256})
	if err != nil {
		return nil, fmt.Errorf("iap: failed to parse JWT: %w", err)
	}

	// Look up the signing key by kid.
	if len(tok.Headers) == 0 {
		return nil, fmt.Errorf("iap: JWT has no headers")
	}
	kid := tok.Headers[0].KeyID
	if kid == "" {
		return nil, fmt.Errorf("iap: JWT has no kid")
	}

	key, err := a.jwksCache.GetKey(kid)
	if err != nil {
		return nil, fmt.Errorf("iap: JWKS key lookup failed for kid %q: %w", kid, err)
	}

	// Verify signature and extract claims.
	var claims iapClaims
	if err := tok.Claims(key, &claims); err != nil {
		return nil, fmt.Errorf("iap: JWT signature verification failed: %w", err)
	}

	// Validate standard claims.
	now := a.now()
	if err := a.validateClaims(&claims, now); err != nil {
		return nil, err
	}

	// Strip IdP prefix and build IAPUserInfo.
	return &IAPUserInfo{
		Subject: stripIAPPrefix(claims.Subject),
		Email:   strings.ToLower(stripIAPPrefix(claims.Email)),
		Domain:  claims.HD,
	}, nil
}

// iapClaims are the JWT claims from an IAP assertion.
type iapClaims struct {
	Issuer   string           `json:"iss"`
	Subject  string           `json:"sub"`
	Audience jwt.Audience     `json:"aud"`
	IssuedAt *jwt.NumericDate `json:"iat"`
	Expiry   *jwt.NumericDate `json:"exp"`
	Email    string           `json:"email"`
	HD       string           `json:"hd,omitempty"` // hosted domain
}

func (a *IAPAuthenticator) validateClaims(claims *iapClaims, now time.Time) error {
	expectedIssuer := a.resolveIssuer()

	// Issuer.
	if claims.Issuer != expectedIssuer {
		return fmt.Errorf("iap: invalid issuer %q, expected %q", claims.Issuer, expectedIssuer)
	}

	// Audience (mandatory binding).
	if !claims.Audience.Contains(a.Audience) {
		return fmt.Errorf("iap: audience mismatch: got %v, expected %q", claims.Audience, a.Audience)
	}

	// Expiry.
	if claims.Expiry == nil {
		return fmt.Errorf("iap: missing exp claim")
	}
	if now.After(claims.Expiry.Time().Add(iapClockSkew)) {
		return fmt.Errorf("iap: token expired at %v", claims.Expiry.Time())
	}

	// Issued-at (with skew: reject if iat is too far in the future).
	if claims.IssuedAt != nil {
		if claims.IssuedAt.Time().After(now.Add(iapClockSkew)) {
			return fmt.Errorf("iap: token issued in the future: iat=%v", claims.IssuedAt.Time())
		}
	}

	// Subject and email must be present.
	if claims.Subject == "" {
		return fmt.Errorf("iap: missing sub claim")
	}
	if claims.Email == "" {
		return fmt.Errorf("iap: missing email claim")
	}

	return nil
}

func (a *IAPAuthenticator) resolveIssuer() string {
	if a.Issuer != "" {
		return a.Issuer
	}
	return DefaultIAPIssuer
}

func (a *IAPAuthenticator) resolveJWKSURL() string {
	if a.JWKSURL != "" {
		return a.JWKSURL
	}
	return DefaultIAPJWKSURL
}

func (a *IAPAuthenticator) resolveHTTPClient() *http.Client {
	if a.HTTPClient != nil {
		return a.HTTPClient
	}
	return &http.Client{Timeout: 10 * time.Second}
}

func (a *IAPAuthenticator) now() time.Time {
	if a.NowFunc != nil {
		return a.NowFunc()
	}
	return time.Now()
}

func (a *IAPAuthenticator) init() {
	a.jwksCache = &iapJWKSCache{
		url:    a.resolveJWKSURL(),
		client: a.resolveHTTPClient(),
	}
}

// stripIAPPrefix removes the "accounts.google.com:" prefix from IAP claims.
func stripIAPPrefix(s string) string {
	return strings.TrimPrefix(s, iapIdPPrefix)
}

// ---- JWKS Cache ----

const jwksDebounceInterval = 5 * time.Second

// iapJWKSCache manages a cached set of JWKS keys with lazy fetch, periodic
// refresh, and on-miss refresh for unknown key IDs.
type iapJWKSCache struct {
	url    string
	client *http.Client

	mu            sync.RWMutex
	keys          map[string]jose.JSONWebKey
	lastFetched   time.Time
	lastAttempted time.Time
	refreshing    bool
}

// GetKey returns the public key for the given kid. If the kid is not found
// in the cache, a refresh is triggered.
func (c *iapJWKSCache) GetKey(kid string) (interface{}, error) {
	// Try cached key first.
	c.mu.RLock()
	if c.keys != nil {
		if k, ok := c.keys[kid]; ok {
			needsRefresh := time.Since(c.lastFetched) > jwksRefreshInterval
			c.mu.RUnlock()
			if needsRefresh {
				go func() { _ = c.refresh() }()
			}
			return k.Key, nil
		}
	}
	c.mu.RUnlock()

	// Kid not found — refresh and retry.
	if err := c.refresh(); err != nil {
		c.mu.RLock()
		hasKeys := len(c.keys) > 0
		c.mu.RUnlock()
		if !hasKeys {
			return nil, fmt.Errorf("jwks fetch failed and no cached keys: %w", err)
		}
		return nil, fmt.Errorf("unknown kid %q (jwks refresh failed: %v)", kid, err)
	}

	c.mu.RLock()
	defer c.mu.RUnlock()
	if k, ok := c.keys[kid]; ok {
		return k.Key, nil
	}
	return nil, fmt.Errorf("unknown kid %q after JWKS refresh", kid)
}

// refresh fetches the JWKS from the endpoint and updates the cache.
func (c *iapJWKSCache) refresh() error {
	c.mu.Lock()

	if time.Since(c.lastAttempted) < jwksDebounceInterval {
		c.mu.Unlock()
		return nil
	}

	if c.refreshing {
		c.mu.Unlock()
		return nil
	}
	c.refreshing = true
	c.lastAttempted = time.Now()
	c.mu.Unlock()

	defer func() {
		c.mu.Lock()
		c.refreshing = false
		c.mu.Unlock()
	}()

	resp, err := c.client.Get(c.url)
	if err != nil {
		log.Printf("iap jwks fetch failed: %v", err)
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		log.Printf("iap jwks fetch returned %d: %s", resp.StatusCode, body)
		return fmt.Errorf("jwks fetch returned %d", resp.StatusCode)
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return fmt.Errorf("jwks read body: %w", err)
	}

	var jwks jose.JSONWebKeySet
	if err := json.Unmarshal(body, &jwks); err != nil {
		return fmt.Errorf("jwks parse: %w", err)
	}

	newKeys := make(map[string]jose.JSONWebKey, len(jwks.Keys))
	for _, k := range jwks.Keys {
		if k.KeyID != "" {
			newKeys[k.KeyID] = k
		}
	}

	c.mu.Lock()
	c.keys = newKeys
	c.lastFetched = time.Now()
	c.mu.Unlock()

	return nil
}

// SetKeys directly sets the cached keys (for testing).
func (c *iapJWKSCache) SetKeys(keys map[string]jose.JSONWebKey) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.keys = keys
	c.lastFetched = time.Now()
}
