# PRE-REGISTRATION — xss-r5-audit leg
Written BEFORE measurement. Tree: /workspace/farmtable-xss-r5-audit @ d305391.

## H1 — C-1 is false: a fully structpb-representable remote_data map reaches taskToProto.
Claim under attack: "values on the GitHub passthrough path carry Go types which are NOT
structpb-representable, so the representability check is a genuine guard."

Observation driving H1: `buildRemoteData` in internal/platform/github/github.go writes
`rd["labels"]` ONLY under `if len(labelNames) > 0`. Every other key it writes is a scalar
(string/int). So a GitHub issue with ZERO labels yields an all-representable map.

- REFUTED IF: every construction path from `buildRemoteData` to `taskToProto` interposes a
  JSON/структpb round trip that would make representability moot, AND/OR `buildRemoteData`
  is provably never the source of a map reaching taskToProto with Go-native types.
- CONFIRMED IF: structpb.NewStruct succeeds on the zero-label map, i.e. the guard does not fire.
- ACTION IF CONFIRMED: report as a finding against the C-1 framing; separately assess whether
  the sanitizer alone is sufficient on that path (it may be — then severity is about the CLAIM,
  not an exploit).
- ACTION IF REFUTED: report the negative result; C-1 stands for the paths I could reach.

## H2 — The sanitizer's `default: return v, true` is exploitable where structpb is NOT downstream.
Observation: export_import.go calls sanitizeRemoteData and serialises to JSON, not structpb.
JSON serialises map[string]string happily; structpb rejects it. So the "fail-closed accident"
backstop is ABSENT on the export path.

- REFUTED IF: no production writer can place a non-walked type (map[string]string, []string,
  []map[string]string, map[string][]string) into a RemoteData that reaches an export, OR the
  export path is gated to a platform whose tasks cannot carry such types.
- CONFIRMED IF: I can name a production writer + a reachable export.
- ACTION IF CONFIRMED: HIGH — nested javascript: URL survives export and re-import.
- ACTION IF REFUTED: report the negative result and state the gate that saves it.

## H3 — structpb-representability is NOT recursively closed over the sanitizer's walk set.
Reasoned claim I want to MEASURE: the sanitizer walks {map[string]any, []any, []map[string]any}.
structpb-representable containers are exactly {map[string]interface{}, []interface{}}.
If that is right, every container node inside a representable value IS walked, and the
sanitizer+structpb pair is sound *on the structpb path*.

- REFUTED IF: I find a type T that is structpb-representable AND can contain a string AND is
  not walked by sanitizeRemoteValue.
- CONFIRMED (soundness) IF: exhaustive enumeration of structpb.NewValue's type switch yields
  only scalars + those two containers.
- ACTION EITHER WAY: state it as a bounded positive result, naming what it does NOT cover
  (the JSON/export path, where structpb is not in the loop at all).

## H4 — The new log statement is an attacker-controlled data sink (log injection).
`log.Printf("%s dropped: ...: %v", field, err)`. structpb errors include
`invalid UTF-8 in string: %v` (UNQUOTED) for a string VALUE, which would write an
attacker-controlled GitHub string raw into the log, newlines and all.

- REFUTED IF: every string reaching remote_data has passed through encoding/json, which
  replaces invalid UTF-8 with U+FFFD, making the invalid-UTF-8 branch unreachable; or the
  installed structpb version quotes the value.
- CONFIRMED IF: I can reach the unquoted branch with a raw byte sequence.
- ACTION IF REFUTED: write it up as a negative result — this is the case the brief says gets
  silently discarded.

## H5 — The new log is an unbounded, attacker-influenced amplification sink.
Before this round the error was discarded (`_`). Now every failing conversion logs one line.
If C-1 is true (labels always []string on passthrough), then EVERY passthrough task logs on
EVERY conversion, including list responses.

- REFUTED IF: taskToProto is not called per-task on a list path, or the passthrough path does
  not reach taskToProto, or logging is rate-limited/sampled.
- CONFIRMED IF: a List RPC over N passthrough tasks emits N log lines.
- ACTION IF CONFIRMED: report as LOW/MEDIUM operational-security finding introduced by THIS diff.
