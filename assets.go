package farmtable

import (
	"embed"
	"errors"
	"io/fs"
)

// WebAssets holds the built web dashboard.
//
// The repository tracks a single placeholder file, web/dist/.gitkeep, so that
// this embed pattern resolves in a clean clone where the frontend has never
// been built. Without it, `go build ./...` fails at pattern-match time and no
// package in the module can be compiled, vetted or listed.
//
// A tree containing only the placeholder therefore embeds a *stub*. Use WebUI
// rather than reading WebAssets directly so that a stub is reported loudly
// instead of being served as a blank dashboard.
//
//go:embed all:web/dist
var WebAssets embed.FS

// ErrWebAssetsNotBuilt reports that the binary was compiled from a tree in
// which the frontend had not been built, so only the tracked placeholder is
// embedded.
var ErrWebAssetsNotBuilt = errors.New(
	"web dashboard assets were not built into this binary: " +
		"the embedded web/dist contains only the repository placeholder " +
		"(run `make web` and rebuild)")

// WebUI returns the embedded web dashboard rooted at web/dist.
//
// It returns ErrWebAssetsNotBuilt when the embedded tree is the placeholder
// stub, which distinguishes "frontend was never built" from a genuine asset
// lookup failure at run time.
func WebUI() (fs.FS, error) {
	subFS, err := fs.Sub(WebAssets, "web/dist")
	if err != nil {
		return nil, err
	}
	if _, err := fs.Stat(subFS, "index.html"); err != nil {
		return nil, ErrWebAssetsNotBuilt
	}
	return subFS, nil
}
