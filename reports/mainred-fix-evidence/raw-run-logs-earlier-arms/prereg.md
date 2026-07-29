# Pre-registration: locating the TestWatchTasks_NoInitial race window

Written BEFORE running the arms. Base: cc927355e5a23c45bfd983cd331eb540b0a61ad5.

## Mechanism under test

`client.WatchTasks(...)` is a gRPC server-streaming call. Stream creation returns to the
client WITHOUT waiting for the server handler to run. The handler
(`internal/server/watch.go:17`) does auth + validation + a DB round trip
(`s.store.GetCollection`, watch.go:43) BEFORE it subscribes at watch.go:60.

`internal/streaming/eventbus.go:68 Publish` iterates only over subscribers present in the
map at publish time. There is no replay and no backlog. An event published before
`Subscribe` lands is therefore lost permanently and silently -- it does not even hit the
"channel full" warning at eventbus.go:79, because the subscriber does not yet exist.

The test (`watch_test.go:110`) calls `CreateTask` immediately after `WatchTasks` returns.
If the handler has not reached line 60, the CREATED event is lost and `recvEvent` at
watch_test.go:118 burns its 5s deadline.

## Discriminator

A statistical flake count cannot localise the window. Injecting a delay can. If the window
is exactly the pre-Subscribe region, then moving a fixed delay across line 60 flips the
outcome.

- ARM A: `time.Sleep(200ms)` inserted IMMEDIATELY BEFORE watch.go:60 Subscribe.
  PREDICTION: TestWatchTasks_NoInitial FAILS, at or near 10/10 runs.
- ARM B: the SAME `time.Sleep(200ms)` inserted IMMEDIATELY AFTER the Subscribe call.
  PREDICTION: TestWatchTasks_NoInitial PASSES, at or near 10/10 runs.

Both arms are the same amount of added latency in the same handler. Only the position
relative to Subscribe differs. If A fails and B passes, the window is the pre-Subscribe
region and nothing else.

## Falsifier

If ARM A passes, the mechanism is NOT a lost event on a late subscription, and the whole
diagnosis inherited from flakepop-81 is wrong -- report that loudly.
If ARM B also fails, the delay is causing failure by some route other than subscription
ordering (e.g. the 5s stream context at watch_test.go:99), and the discriminator is void.

## Scope note

Arms A and B are DIAGNOSTIC ONLY. Neither is the fix and neither gets committed.
