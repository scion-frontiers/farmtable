package server

import (
	"testing"

	"github.com/farmtable-io/farmtable/internal/store/ent"
	"github.com/farmtable-io/farmtable/internal/store/ent/collection"
)

func TestCollectionSupportsGraph_PlatformDefaults(t *testing.T) {
	tests := []struct {
		platform collection.Platform
		want     bool
	}{
		{collection.PlatformFarmtable, true},
		{collection.PlatformGithub, true},
		{collection.PlatformLinear, true},
		{collection.PlatformJira, true},
		{collection.PlatformAsana, false},
		{collection.PlatformBeads, false},
	}
	for _, tt := range tests {
		t.Run(string(tt.platform), func(t *testing.T) {
			c := &ent.Collection{Platform: tt.platform}
			got := collectionSupportsGraph(c)
			if got != tt.want {
				t.Errorf("collectionSupportsGraph(%s) = %v, want %v", tt.platform, got, tt.want)
			}
		})
	}
}

func TestCollectionSupportsGraph_ExplicitOverrideTrue(t *testing.T) {
	// Asana defaults to false; override to true via remote_data.
	c := &ent.Collection{
		Platform:   collection.PlatformAsana,
		RemoteData: map[string]interface{}{"graph_queries": true},
	}
	if got := collectionSupportsGraph(c); !got {
		t.Errorf("expected true when graph_queries override is true, got false")
	}
}

func TestCollectionSupportsGraph_ExplicitOverrideFalse(t *testing.T) {
	// GitHub defaults to true; override to false via remote_data.
	c := &ent.Collection{
		Platform:   collection.PlatformGithub,
		RemoteData: map[string]interface{}{"graph_queries": false},
	}
	if got := collectionSupportsGraph(c); got {
		t.Errorf("expected false when graph_queries override is false, got true")
	}
}

func TestCollectionSupportsGraph_NilRemoteData(t *testing.T) {
	c := &ent.Collection{
		Platform:   collection.PlatformGithub,
		RemoteData: nil,
	}
	if got := collectionSupportsGraph(c); !got {
		t.Errorf("expected true for github with nil remote_data, got false")
	}
}

func TestCollectionSupportsGraph_EmptyRemoteData(t *testing.T) {
	c := &ent.Collection{
		Platform:   collection.PlatformGithub,
		RemoteData: map[string]interface{}{},
	}
	if got := collectionSupportsGraph(c); !got {
		t.Errorf("expected true for github with empty remote_data, got false")
	}
}

func TestCollectionSupportsGraph_NonBoolGraphQueriesValue(t *testing.T) {
	// If graph_queries is present but not a bool, fall back to platform default.
	c := &ent.Collection{
		Platform:   collection.PlatformAsana,
		RemoteData: map[string]interface{}{"graph_queries": "yes"},
	}
	if got := collectionSupportsGraph(c); got {
		t.Errorf("expected false for asana with non-bool graph_queries value, got true")
	}
}

func TestCollectionSupportsGraph_UnknownPlatform(t *testing.T) {
	c := &ent.Collection{
		Platform: collection.Platform("unknown"),
	}
	if got := collectionSupportsGraph(c); got {
		t.Errorf("expected false for unknown platform, got true")
	}
}

func TestCollectionSupportsGraph_OtherRemoteDataKeysIgnored(t *testing.T) {
	// Other keys in remote_data should not affect the result.
	c := &ent.Collection{
		Platform: collection.PlatformBeads,
		RemoteData: map[string]interface{}{
			"some_other_key": true,
		},
	}
	if got := collectionSupportsGraph(c); got {
		t.Errorf("expected false for beads with unrelated remote_data keys, got true")
	}
}
