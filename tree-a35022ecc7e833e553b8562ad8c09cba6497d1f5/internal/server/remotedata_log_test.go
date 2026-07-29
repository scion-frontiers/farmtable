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
	remoteDataLogSamplers = map[string]*remoteDataSamplerState{}
	remoteDataLogMu.Unlock()

	prevNow := remoteDataLogNow
	t.Cleanup(func() {
		log.SetOutput(prevOut)
		log.SetFlags(prevFlags)
		remoteDataLogNow = prevNow
		remoteDataLogMu.Lock()
		remoteDataLogSamplers = map[string]*remoteDataSamplerState{}
		remoteDataLogMu.Unlock()
	})
	return &buf
}

// withRemoteDataLogClock pins the sampler's clock so elapsed time is an input
// rather than a race. Returns a function to advance it.
//
// IT REGISTERS ITS OWN RESTORE. It did not, and relied on captureRemoteDataLog's
// t.Cleanup to put remoteDataLogNow back -- which was correct only because every
// call site happened to call capture first. That is a precondition living in
// another function with nothing asserting it. A future test calling only this
// helper would leak a FROZEN CLOCK into every subsequent test in
// internal/server, and the resulting failures would appear in unrelated tests
// with no visible cause. Cheap to make unconditional; expensive to debug once.
//
// Restoring twice is harmless: the cleanups run LIFO and both restore to the
// same value.
func withRemoteDataLogClock(t *testing.T) func(time.Duration) {
	t.Helper()
	prevNow := remoteDataLogNow
	t.Cleanup(func() { remoteDataLogNow = prevNow })
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

// TestRemoteDataDropLogIsSampledPerField is the test whose ABSENCE was the bug.
//
// Every other test in this file passes "task.remote_data". Not one passed
// "collection.remote_data", so `field` was exercised only as a formatting
// parameter and the sampler's single shared limiter looked correct for three
// rounds.
//
// The two fields are not interchangeable and their rates differ by orders of
// magnitude. `labels` is unconditional on the passthrough task path, so
// task.remote_data drops on EVERY task of EVERY page any time an authenticated
// user browses a passthrough collection. collection.remote_data drops rarely --
// and it is the one that matters, because collection remote_data is the sole
// input to the write-authorization gate documented in collectionToProto.
//
// With one shared limiter the noisy field silences the important one, and the
// shared suppressed counter meant the collection drop did not even register as
// a number. THE FAILURE IS SILENT AND IT IS IN THE DIRECTION OF HIDING THINGS.
func TestRemoteDataDropLogIsSampledPerField(t *testing.T) {
	buf := captureRemoteDataLog(t)
	advance := withRemoteDataLogClock(t)

	bad := map[string]any{"labels": []string{"bug"}}

	// A page of passthrough tasks: one line out, the rest counted.
	const page = 50
	for range page {
		structOrNilLoggingErr(bad, "task.remote_data")
	}
	if n := countLines(buf); n != 1 {
		t.Fatalf("setup: a %d-task page produced %d lines, want 1; the task-side sampler is "+
			"not behaving, so the cross-field assertion below would be measuring nothing",
			page, n)
	}

	// THE ASSERTION. Well inside the interval, so a process-wide limiter is
	// still holding it shut. A per-field limiter has never seen this field.
	advance(time.Second)
	structOrNilLoggingErr(bad, "collection.remote_data")

	out := buf.String()
	if !strings.Contains(out, "collection.remote_data") {
		t.Fatalf("A COLLECTION remote_data DROP WAS SWALLOWED by task-side traffic %v earlier.\n"+
			"The sampler is keyed per process rather than per field, so the highest-volume "+
			"field in the system silences the one that gates write authorization. Browsing a "+
			"passthrough collection is enough to keep task.remote_data dropping continuously, "+
			"which means this line can be suppressed indefinitely and nothing reports it.\n"+
			"Do not fix this by shortening the interval; key the limiter by field.\ngot: %s",
			time.Second, out)
	}
	if n := countLines(buf); n != 2 {
		t.Errorf("want exactly 2 lines (one task, one collection), got %d.\ngot: %s", n, out)
	}

	// The counters must be separate too, not just the timers. The collection
	// line is this field's FIRST, so it has nothing to report as suppressed;
	// if it inherits the task field's 49 it is lying about a field it has
	// never seen.
	last := out[strings.LastIndex(strings.TrimRight(out, "\n"), "\n")+1:]
	if strings.Contains(last, "suppressed") {
		t.Errorf("the first collection line reports suppressed drops it did not have. The "+
			"COUNTER is still shared even if the timer is not, so the volume number now "+
			"attributes one field's traffic to another.\ngot: %s", last)
	}
}

// TestRemoteDataUnrepresentableKeyIsNotAParadox covers the branch whose message
// used to say "this should not happen".
//
// It happens. structpb.NewStruct requires every KEY to be valid UTF-8;
// NewValue is never asked about keys. So a map whose every value is
// representable and whose key is not lands in that branch deterministically.
// Go strings carry no UTF-8 guarantee, so a remote API or an uploaded document
// can produce one and nothing upstream rejects it.
//
// A message telling an operator they have hit an impossible state, when they
// have hit a non-UTF-8 key, sends them to the wrong place entirely.
func TestRemoteDataUnrepresentableKeyIsNotAParadox(t *testing.T) {
	buf := captureRemoteDataLog(t)
	withRemoteDataLogClock(t)

	got := structOrNilLoggingErr(map[string]any{
		string([]byte{0xff, 0xfe}): "a perfectly representable string",
	}, "collection.remote_data")

	if got != nil {
		t.Fatal("structpb accepted a map with an invalid-UTF-8 key; the premise of this test " +
			"no longer holds and the branch it covers may now be unreachable")
	}

	out := buf.String()
	if strings.Contains(out, "should not happen") {
		t.Errorf("the drop message still calls this state impossible. It is reachable and "+
			"deterministic -- an invalid-UTF-8 KEY -- and telling the operator otherwise "+
			"costs them the one clue in the line.\ngot: %s", out)
	}
	if !strings.Contains(out, "KEY") {
		t.Errorf("the message does not tell the operator the fault is in a key rather than a "+
			"value. unrepresentableKeys found no offending value, which is precisely the "+
			"signal that the key is at fault; saying so is the entire content of this "+
			"branch.\ngot: %s", out)
	}
}

// TestRemoteDataLogQuotesAttackerKeys covers the %q.
//
// Keys reach log.Printf from uploaded import documents and platform API
// responses. A key containing a newline FORGES LOG RECORDS in any line-oriented
// pipeline; one containing a terminal escape acts on whoever tails the file.
func TestRemoteDataLogQuotesAttackerKeys(t *testing.T) {
	buf := captureRemoteDataLog(t)
	withRemoteDataLogClock(t)

	structOrNilLoggingErr(map[string]any{
		"evil\nkey": []string{"unrepresentable, so this key gets reported"},
	}, "collection.remote_data")

	out := buf.String()
	if out == "" {
		t.Fatal("nothing logged; this test is measuring nothing")
	}
	if strings.Contains(out, "evil\nkey") {
		t.Errorf("the key was interpolated RAW and its newline is now a record separator: "+
			"everything after it reads as a separate log entry that no code in this "+
			"repository wrote. Use %%q.\ngot: %s", out)
	}
	if !strings.Contains(out, `"evil\nkey"`) {
		t.Errorf("the key is neither raw nor quoted-and-escaped, so it is unclear what the "+
			"formatting is doing.\ngot: %s", out)
	}
	if n := countLines(buf); n != 1 {
		t.Errorf("one drop produced %d log lines. A single drop must be a single record, or "+
			"the newline in the key has split it.\ngot: %s", n, out)
	}
}
