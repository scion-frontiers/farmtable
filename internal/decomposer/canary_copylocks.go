package decomposer

// CANARY ONLY - NEVER MERGE.
//
// `go vet` reports "variable declaration copies lock value". copylocks is NOT
// in the vet subset `go test` runs by default, so this compiles, and the whole
// Go suite passes. Only the Lint step can see it -- which is the point: the red
// must land on the gate under test and on no earlier step.

import "sync"

var canaryMuA sync.Mutex

var canaryMuB = canaryMuA
