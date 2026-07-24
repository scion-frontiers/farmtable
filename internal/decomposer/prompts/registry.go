// Package prompts provides a registry of named, versioned decomposer prompt
// variants. Each variant is an embedded .txt file with metadata describing its
// purpose. Callers can look up a prompt by name (returns the latest version) or
// by "name@version" for a specific version.
package prompts

import (
	"embed"
	"fmt"
	"sort"
	"strings"
)

//go:embed *.txt
var promptFS embed.FS

// Variant describes a single prompt variant.
type Variant struct {
	Name        string // e.g. "default"
	Version     string // e.g. "v1"
	Description string // human-readable summary
	Text        string // the full prompt text
}

// registry is the ordered list of all known variants (populated in init).
var registry []Variant

func init() {
	// Register variants. Order determines listing order; the last entry for a
	// given name wins on a name-only lookup (latest version).
	register("default", "v1", "Standard 6-12 subtask decomposition", "v1_default.txt")
	register("constrained", "v1", "Constrained 3-12 subtask decomposition with consolidation rule", "v1_constrained.txt")
}

func register(name, version, description, filename string) {
	data, err := promptFS.ReadFile(filename)
	if err != nil {
		panic(fmt.Sprintf("prompts: failed to embed %s: %v", filename, err))
	}
	registry = append(registry, Variant{
		Name:        name,
		Version:     version,
		Description: description,
		Text:        string(data),
	})
}

// Get retrieves a prompt variant. The key can be:
//   - A bare name (e.g. "default") — returns the latest registered version.
//   - A name@version string (e.g. "default@v1") — returns that exact version.
//
// Returns an error if no matching variant is found.
func Get(key string) (Variant, error) {
	name, version := parseKey(key)

	if version != "" {
		// Exact match.
		for _, v := range registry {
			if v.Name == name && v.Version == version {
				return v, nil
			}
		}
		return Variant{}, fmt.Errorf("prompt variant %q not found", key)
	}

	// Name-only: return the last registered version (latest).
	var found *Variant
	for i := range registry {
		if registry[i].Name == name {
			found = &registry[i]
		}
	}
	if found == nil {
		return Variant{}, fmt.Errorf("prompt variant %q not found", key)
	}
	return *found, nil
}

// List returns all registered variants, sorted by name then version.
func List() []Variant {
	out := make([]Variant, len(registry))
	copy(out, registry)
	sort.Slice(out, func(i, j int) bool {
		if out[i].Name != out[j].Name {
			return out[i].Name < out[j].Name
		}
		return out[i].Version < out[j].Version
	})
	return out
}

// Default returns the default prompt text (equivalent to Get("default").Text).
func Default() string {
	v, err := Get("default")
	if err != nil {
		panic("prompts: missing default variant")
	}
	return v.Text
}

// parseKey splits "name@version" into (name, version).
// If there is no "@", version is empty.
func parseKey(key string) (string, string) {
	if i := strings.Index(key, "@"); i >= 0 {
		return key[:i], key[i+1:]
	}
	return key, ""
}
