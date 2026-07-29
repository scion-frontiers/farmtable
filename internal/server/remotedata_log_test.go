package server

import (
	"bytes"
	"log"
	"strings"
	"testing"
	"time"
)

// THIS FILE EXISTS BECAUSE THE LOG LINE WAS UNTESTED WHILE LOOKING TESTED.
//
// Before it, deleting the log.Printf from structOrNilLoggingErr entirely left
// the whole suite GREEN. A mutant that did exactly that SURVIVED in the r5
// round. The reason is worth stating, because it is a general trap:
// TestMapStringStringStaysUnrepresentable_GuardsO1 causes the line to be
// PRINTED, and a human running that test with -v SEES it. Nothing ASSERTS it.
// Output that a person observes while reading a test run is not coverage, and
// it is the most convincing kind of non-coverage there is.
//
// Everything here goes through the real `log` package via log.SetOutput rather
// than through an injected logger interface, so what is captured is what the
// production code actually emits.

// captureRemoteDataLog redirects the standard logger into a buffer and resets
// the sampler, restoring both when the test ends.
//
// The sampler state is package-level and therefore shared between tests. It is
// reset on the way IN as well as the way out: a leftover remoteDataLogLast from
// an earlier test would silently suppress the first line this test expects, and
// that failure would look like "the log line is gone" rather than "the fixture
// is dirty". These tests do not call t.Parallel for the same reason.
func captureRemoteDataLog(t *testing.T) *bytes.Buffer {
	t.Helper()

	var buf bytes.Buffer
	prevOut := log.Writer()
	prevFlags := log.Flags()
	log.SetOutput(&buf)
	log.SetFlags(0)

	remoteDataLogMu.Lock()
	remoteDataLogLast = time.Time{}
	remoteDataLogSuppressed = 0
	remoteDataLogMu.Unlock()

	prevNow := remoteDataLogNow
	t.Cleanup(func() {
		log.SetOutput(prevOut)
		log.SetFlags(prevFlags)
		remoteDataLogNow = prevNow
		remoteDataLogMu.Lock()
		remoteDataLogLast = time.Time{}
		remoteDataLogSuppressed = 0
		remoteDataLogMu.Unlock()
	})
	return &buf
}

// withRemoteDataLogClock pins the sampler's clock so elapsed time is an input
// rather than a race. Returns a function to advance it.
func withRemoteDataLogClock(t *testing.T) func(time.Duration) {
	t.Helper()
	now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	remoteDataLogNow = func() time.Time { return now }
	return func(d time.Duration) { now = now.Add(d) }
}

func countLines(buf *bytes.Buffer) int {
	s := strings.TrimSpace(buf.String())
	if s == "" {
		return 0
	}
	return len(strings.Split(s, "\n"))
}

// TestRemoteDataDropIsLoggedWithOffendingKeys is the assertion whose absence let
// the delete-the-log mutant survive.
func TestRemoteDataDropIsLoggedWithOffendingKeys(t *testing.T) {
	buf := captureRemoteDataLog(t)
	withRemoteDataLogClock(t)

	// Two INDEPENDENT offenders, because structpb.NewStruct's own error names
	// only the first key it trips over. If the message reported just that, an
	// operator would fix labels, redeploy, and find the field still nil with no
	// new information in the log.
	got := structOrNilLoggingErr(map[string]any{
		"labels":     []string{"bug"},
		"sub_issues": []map[string]any{{"number": 8}},
		"number":     7,
	}, "task.remote_data")

	if got != nil {
		t.Fatal("structOrNilLoggingErr returned a struct for an unrepresentable map; " +
			"the drop this test is about did not happen, so the rest of it is vacuous")
	}

	out := buf.String()
	if out == "" {
		t.Fatal("NOTHING WAS LOGGED when remote_data was dropped. Making the drop audible is " +
			"the control; a silent drop is how this defect stayed invisible for five rounds. " +
			"Do not delete this assertion to make a quiet converter pass.")
	}
	for _, want := range []string{"task.remote_data", "labels", "[]string", "sub_issues"} {
		if !strings.Contains(out, want) {
			t.Errorf("log line does not mention %q, so the drop is visible but not diagnosable.\n"+
				"A line that says a conversion failed without naming the offending key and its Go "+
				"type tells an operator nothing they can act on.\ngot: %s", want, out)
		}
	}
	if strings.Contains(out, "number (") {
		t.Errorf("log line names `number` as an offender, but an int is perfectly representable; "+
			"unrepresentableKeys is over-reporting and the message will send people after the "+
			"wrong key.\ngot: %s", out)
	}
}

// TestRemoteDataDropLogIsSampled pins the volume fix.
func TestRemoteDataDropLogIsSampled(t *testing.T) {
	buf := captureRemoteDataLog(t)
	advance := withRemoteDataLogClock(t)

	// A full page of passthrough tasks. Every one of them fails conversion,
	// which is the whole point: labels is unconditional on that path.
	const page = 50
	bad := map[string]any{"labels": []string{"bug"}}
	for range page {
		structOrNilLoggingErr(bad, "task.remote_data")
	}

	if n := countLines(buf); n != 1 {
		t.Fatalf("a %d-task page produced %d log lines, want exactly 1.\n"+
			"This is the defect this sampler exists to fix: an unsampled line here put "+
			"50-200 identical entries into a production log pipeline for any authenticated "+
			"user browsing a passthrough collection.", page, n)
	}

	// Below the interval: still silent, still counting.
	advance(remoteDataLogInterval - time.Second)
	structOrNilLoggingErr(bad, "task.remote_data")
	if n := countLines(buf); n != 1 {
		t.Fatalf("a drop %v after the last line produced a second line; the sampler is not "+
			"holding its interval (%v). got %d lines", remoteDataLogInterval-time.Second,
			remoteDataLogInterval, n)
	}

	// Past the interval: one more line, carrying the suppressed count.
	advance(2 * time.Second)
	structOrNilLoggingErr(bad, "task.remote_data")
	if n := countLines(buf); n != 2 {
		t.Fatalf("no line after the interval elapsed; the sampler has gone permanently quiet "+
			"rather than sampling, which is indistinguishable from deleting it. got %d lines", n)
	}

	last := buf.String()[strings.LastIndex(strings.TrimRight(buf.String(), "\n"), "\n")+1:]
	if !strings.Contains(last, "suppressed") {
		t.Errorf("the second line does not report the suppressed count, so the VOLUME signal is "+
			"lost. A sampled line without a count cannot distinguish one drop from a thousand, "+
			"and that number is the thing an operator escalates on.\ngot: %s", last)
	}
	// 50 in the burst were suppressed after the first was printed, plus the one
	// below the interval. The first of the 50 was itself printed, so 49 + 1.
	if !strings.Contains(last, "50") {
		t.Errorf("suppressed count is wrong: 49 from the page plus 1 below the interval is 50.\n"+
			"An off-by-one here is worth catching, because this number is the only evidence of "+
			"volume that survives sampling.\ngot: %s", last)
	}
}

// TestRemoteDataRepresentableMapLogsNothing is the positive control.
//
// Without it, every assertion above would still pass if the converter logged on
// EVERY call rather than only on failure -- which would be a worse log-volume
// defect than the one this round is fixing.
func TestRemoteDataRepresentableMapLogsNothing(t *testing.T) {
	buf := captureRemoteDataLog(t)
	withRemoteDataLogClock(t)

	got := structOrNilLoggingErr(map[string]any{
		"labels": []any{"bug"},
		"number": 7,
	}, "task.remote_data")

	if got == nil {
		t.Fatal("a fully representable map was dropped; this control is measuring nothing")
	}
	if n := countLines(buf); n != 0 {
		t.Errorf("a SUCCESSFUL conversion logged %d line(s): %s\n"+
			"The log must fire on the failure path only. Logging on success would reintroduce "+
			"the per-task volume defect on every read in the system, not just passthrough ones.",
			n, buf.String())
	}
}
