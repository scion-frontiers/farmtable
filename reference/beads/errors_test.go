package beads_test

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/steveyegge/beads"
	"github.com/steveyegge/beads/internal/storage"
	"github.com/steveyegge/beads/internal/storage/domain"
	"github.com/steveyegge/beads/internal/types"
)

// TestReExportCloseBlocked proves the public beads.ErrCloseBlocked alias is the
// same value as the internal sentinel and composes through errors.Is when
// wrapped — the property CloseIssueChecked callers rely on to detect a guard
// refusal without importing internal/storage.
func TestReExportCloseBlocked(t *testing.T) {
	t.Parallel()

	if beads.ErrCloseBlocked != storage.ErrCloseBlocked {
		t.Error("beads.ErrCloseBlocked is not the internal sentinel value (identity broken)")
	}
	wrapped := fmt.Errorf("x: %w", beads.ErrCloseBlocked)
	if !errors.Is(wrapped, beads.ErrCloseBlocked) {
		t.Errorf("errors.Is(wrapped, beads.ErrCloseBlocked) = false; err = %v", wrapped)
	}
}

// TestReExportedSentinelIdentity proves each public sentinel is the SAME value
// as the internal one it aliases, so errors.Is composes across the package
// boundary without any bridging.
func TestReExportedSentinelIdentity(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name     string
		exported error
		internal error
	}{
		{"ErrNotFound", beads.ErrNotFound, storage.ErrNotFound},
		{"ErrAlreadyClaimed", beads.ErrAlreadyClaimed, storage.ErrAlreadyClaimed},
		{"ErrNotClaimable", beads.ErrNotClaimable, storage.ErrNotClaimable},
		{"ErrSelfDependency", beads.ErrSelfDependency, domain.ErrSelfDependency},
		{"ErrDependencyCycle", beads.ErrDependencyCycle, domain.ErrDependencyCycle},
		{"ErrFieldTooLong", beads.ErrFieldTooLong, types.ErrFieldTooLong},
	}
	for _, tc := range cases {
		if tc.exported != tc.internal {
			t.Errorf("beads.%s is not the internal sentinel value (identity broken)", tc.name)
		}
	}
}

// stubDepRepo satisfies domain.DependencySQLRepository via the embedded
// interface; only the two methods dependencyUseCaseImpl.add consults before
// returning a self-dep/cycle sentinel are implemented. Any other call would
// nil-panic, which keeps the stub honest about the exact surface these
// branches touch.
type stubDepRepo struct {
	domain.DependencySQLRepository
	hasCycle bool
}

func (s stubDepRepo) ValidateBlockingHierarchy(context.Context, *types.Dependency) error {
	return nil
}

func (s stubDepRepo) HasCycle(context.Context, string, string) (bool, error) {
	return s.hasCycle, nil
}

// TestReExportedSentinelCatchesRealProductionError drives ACTUAL converted
// production returns — the domain dependency use case's self-dep and cycle
// branches — and asserts the PUBLIC aliases match them via errors.Is. This is
// the property the re-export exists to provide, verified end to end through
// real code rather than by wrapping a sentinel with itself.
func TestReExportedSentinelCatchesRealProductionError(t *testing.T) {
	t.Parallel()

	uc := domain.NewDependencyUseCase(stubDepRepo{})
	selfErr := uc.AddDependency(context.Background(),
		&types.Dependency{IssueID: "a", DependsOnID: "a", Type: types.DepBlocks}, "tester")
	if !errors.Is(selfErr, beads.ErrSelfDependency) {
		t.Errorf("errors.Is(real self-dep err, beads.ErrSelfDependency) = false; err = %v", selfErr)
	}

	uc = domain.NewDependencyUseCase(stubDepRepo{hasCycle: true})
	cycleErr := uc.AddDependency(context.Background(),
		&types.Dependency{IssueID: "a", DependsOnID: "b", Type: types.DepBlocks}, "tester")
	if !errors.Is(cycleErr, beads.ErrDependencyCycle) {
		t.Errorf("errors.Is(real cycle err, beads.ErrDependencyCycle) = false; err = %v", cycleErr)
	}
}

// TestReExportFieldTooLong proves the public beads.ErrFieldTooLong alias is the
// same value as the internal types sentinel and composes through errors.Is when
// wrapped — the property length-validation callers rely on to detect an
// over-length assignee/owner/label without importing internal/types. It also
// checks the MaxFieldLen constant re-export tracks the source of truth.
func TestReExportFieldTooLong(t *testing.T) {
	t.Parallel()

	if beads.ErrFieldTooLong != types.ErrFieldTooLong {
		t.Error("beads.ErrFieldTooLong is not the internal sentinel value (identity broken)")
	}
	wrapped := fmt.Errorf("x: %w", beads.ErrFieldTooLong)
	if !errors.Is(wrapped, beads.ErrFieldTooLong) {
		t.Errorf("errors.Is(wrapped, beads.ErrFieldTooLong) = false; err = %v", wrapped)
	}
	if beads.MaxFieldLen != types.MaxFieldLen {
		t.Errorf("beads.MaxFieldLen = %d, want types.MaxFieldLen = %d", beads.MaxFieldLen, types.MaxFieldLen)
	}
}
