package prompts

import (
	"strings"
	"testing"
)

func TestGet_ByName(t *testing.T) {
	v, err := Get("default")
	if err != nil {
		t.Fatalf("Get(default): %v", err)
	}
	if v.Name != "default" {
		t.Errorf("Name = %q, want %q", v.Name, "default")
	}
	if v.Version != "v1" {
		t.Errorf("Version = %q, want %q", v.Version, "v1")
	}
	if v.Text == "" {
		t.Error("Text is empty")
	}
}

func TestGet_ByNameVersion(t *testing.T) {
	v, err := Get("constrained@v1")
	if err != nil {
		t.Fatalf("Get(constrained@v1): %v", err)
	}
	if v.Name != "constrained" {
		t.Errorf("Name = %q, want %q", v.Name, "constrained")
	}
	if v.Version != "v1" {
		t.Errorf("Version = %q, want %q", v.Version, "v1")
	}
	if !strings.Contains(v.Text, "3-12") {
		t.Error("constrained variant should contain '3-12' range")
	}
}

func TestGet_NotFound(t *testing.T) {
	tests := []string{
		"nonexistent",
		"default@v99",
		"nonexistent@v1",
	}
	for _, key := range tests {
		_, err := Get(key)
		if err == nil {
			t.Errorf("Get(%q) should return error", key)
		}
	}
}

func TestList(t *testing.T) {
	variants := List()
	if len(variants) < 2 {
		t.Fatalf("List() returned %d variants, want at least 2", len(variants))
	}

	// Verify sorted by name.
	for i := 1; i < len(variants); i++ {
		if variants[i-1].Name > variants[i].Name {
			t.Errorf("List() not sorted: %q > %q", variants[i-1].Name, variants[i].Name)
		}
	}

	// Verify known variants are present.
	names := make(map[string]bool)
	for _, v := range variants {
		names[v.Name] = true
	}
	for _, want := range []string{"default", "constrained"} {
		if !names[want] {
			t.Errorf("List() missing variant %q", want)
		}
	}
}

func TestDefault(t *testing.T) {
	text := Default()
	if text == "" {
		t.Fatal("Default() returned empty string")
	}
	// The default prompt should mention 6-12 subtasks.
	if !strings.Contains(text, "6-12") {
		t.Error("Default() should contain '6-12' range")
	}
}

func TestDefaultMatchesGet(t *testing.T) {
	v, err := Get("default")
	if err != nil {
		t.Fatalf("Get(default): %v", err)
	}
	if Default() != v.Text {
		t.Error("Default() text does not match Get(\"default\").Text")
	}
}

func TestVariantDescriptions(t *testing.T) {
	for _, v := range List() {
		if v.Description == "" {
			t.Errorf("variant %s@%s has empty description", v.Name, v.Version)
		}
	}
}

func TestConstrainedDifferences(t *testing.T) {
	def, err := Get("default")
	if err != nil {
		t.Fatalf("Get(default): %v", err)
	}
	con, err := Get("constrained")
	if err != nil {
		t.Fatalf("Get(constrained): %v", err)
	}

	// Constrained should use 3-12, not 6-12.
	if !strings.Contains(con.Text, "3-12") {
		t.Error("constrained variant should contain '3-12'")
	}
	if strings.Contains(con.Text, "6-12") {
		t.Error("constrained variant should NOT contain '6-12'")
	}

	// Default should use 6-12, not 3-12.
	if !strings.Contains(def.Text, "6-12") {
		t.Error("default variant should contain '6-12'")
	}

	// Constrained should have the consolidation rule.
	if !strings.Contains(con.Text, "fewer than 3 subtasks") {
		t.Error("constrained variant should contain consolidation rule")
	}
}
