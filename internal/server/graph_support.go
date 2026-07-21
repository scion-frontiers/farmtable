package server

import (
	"github.com/farmtable-io/farmtable/internal/store/ent"
	"github.com/farmtable-io/farmtable/internal/store/ent/collection"
)

// platformGraphDefaults maps each platform to whether it supports graph queries
// (critical path, blocking graph, etc.) by default.
var platformGraphDefaults = map[collection.Platform]bool{
	collection.PlatformFarmtable: true,
	collection.PlatformGithub:    true,
	collection.PlatformLinear:    true,
	collection.PlatformJira:      true,
	collection.PlatformAsana:     false,
	collection.PlatformBeads:     false,
}

// collectionSupportsGraph reports whether the given collection supports graph
// queries (critical path analysis, blocking graph, bottleneck detection, etc.).
//
// It first checks the collection's RemoteData for an explicit "graph_queries"
// boolean override. If the key is present and holds a bool value, that value is
// returned. Otherwise, the function falls back to a per-platform default.
func collectionSupportsGraph(c *ent.Collection) bool {
	if c.RemoteData != nil {
		if v, ok := c.RemoteData["graph_queries"]; ok {
			if b, isBool := v.(bool); isBool {
				return b
			}
		}
	}
	if def, ok := platformGraphDefaults[c.Platform]; ok {
		return def
	}
	// Unknown platforms default to false.
	return false
}
