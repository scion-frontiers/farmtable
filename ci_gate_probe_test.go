package farmtable

import "testing"

// TestCIGateProbe_DeliberateFailure fails on purpose.
//
// SCRATCH COMMIT -- THIS FILE MUST NOT SURVIVE INTO main.
//
// It exists to prove that the CI gate added in this branch can actually go red.
// A gate that has only ever been observed passing has been observed agreeing,
// not gating. This probe is a Go test failure specifically, because it must
// travel through the `go test ... | tee` pipeline that silently swallowed a
// genuine failure in the first run of this workflow.
func TestCIGateProbe_DeliberateFailure(t *testing.T) {
	t.Fatal("deliberate failure: proving the CI gate can go red")
}
