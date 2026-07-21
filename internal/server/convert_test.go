package server

import (
	"testing"
	"time"

	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
	"github.com/farmtable-io/farmtable/internal/store/ent"
	"github.com/farmtable-io/farmtable/internal/store/ent/task"
	"github.com/google/uuid"
)

func TestPlatformStringToProto(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want pb.Platform
	}{
		{"github", "github", pb.Platform_PLATFORM_GITHUB},
		{"linear", "linear", pb.Platform_PLATFORM_LINEAR},
		{"jira", "jira", pb.Platform_PLATFORM_JIRA},
		{"asana", "asana", pb.Platform_PLATFORM_ASANA},
		{"beads", "beads", pb.Platform_PLATFORM_BEADS},
		{"farmtable explicit", "farmtable", pb.Platform_PLATFORM_FARMTABLE},
		{"empty string fallback", "", pb.Platform_PLATFORM_FARMTABLE},
		{"unknown fallback", "trello", pb.Platform_PLATFORM_FARMTABLE},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := platformStringToProto(tt.in)
			if got != tt.want {
				t.Errorf("platformStringToProto(%q) = %v, want %v", tt.in, got, tt.want)
			}
		})
	}
}

func TestTaskToProto_PlatformFromRemoteData(t *testing.T) {
	now := time.Now()

	baseTask := func() *ent.Task {
		return &ent.Task{
			ID:           uuid.New(),
			Title:        "test task",
			Phase:        task.PhaseOpen,
			Stage:        task.StageTriage,
			CollectionID: uuid.New(),
			CreatedAt:    now,
			UpdatedAt:    now,
			Version:      "1",
		}
	}

	t.Run("no RemoteData maps to PLATFORM_FARMTABLE", func(t *testing.T) {
		tk := baseTask()
		tk.RemoteData = nil

		got := taskToProto(tk)
		if got.Platform != pb.Platform_PLATFORM_FARMTABLE {
			t.Errorf("platform = %v, want PLATFORM_FARMTABLE", got.Platform)
		}
	})

	t.Run("empty RemoteData maps to PLATFORM_FARMTABLE", func(t *testing.T) {
		tk := baseTask()
		tk.RemoteData = map[string]interface{}{}

		got := taskToProto(tk)
		if got.Platform != pb.Platform_PLATFORM_FARMTABLE {
			t.Errorf("platform = %v, want PLATFORM_FARMTABLE", got.Platform)
		}
	})

	t.Run("RemoteData platform=github maps to PLATFORM_GITHUB", func(t *testing.T) {
		tk := baseTask()
		tk.RemoteData = map[string]interface{}{
			"platform": "github",
		}

		got := taskToProto(tk)
		if got.Platform != pb.Platform_PLATFORM_GITHUB {
			t.Errorf("platform = %v, want PLATFORM_GITHUB", got.Platform)
		}
	})

	t.Run("RemoteData platform=linear maps to PLATFORM_LINEAR", func(t *testing.T) {
		tk := baseTask()
		tk.RemoteData = map[string]interface{}{
			"platform": "linear",
		}

		got := taskToProto(tk)
		if got.Platform != pb.Platform_PLATFORM_LINEAR {
			t.Errorf("platform = %v, want PLATFORM_LINEAR", got.Platform)
		}
	})

	t.Run("RemoteData with non-string platform falls back to PLATFORM_FARMTABLE", func(t *testing.T) {
		tk := baseTask()
		tk.RemoteData = map[string]interface{}{
			"platform": 42,
		}

		got := taskToProto(tk)
		if got.Platform != pb.Platform_PLATFORM_FARMTABLE {
			t.Errorf("platform = %v, want PLATFORM_FARMTABLE", got.Platform)
		}
	})
}
