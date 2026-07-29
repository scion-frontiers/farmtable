# Changelog

## [0.10.0](https://github.com/ghchinoy/watcher/compare/agent_watcher-v0.9.0...agent_watcher-v0.10.0) (2026-07-11)


### Features

* add global Command Palette search for issues ([dc0f227](https://github.com/ghchinoy/watcher/commit/dc0f227cdbfae66ed9f444e4fc271d7cf7461935))
* document performance, concurrency, and UI components in widget tree and architecture ([0c26658](https://github.com/ghchinoy/watcher/commit/0c26658dff51aa1d31fdc486816e4b8707a501af))


### Bug Fixes

* auto-expand and highlight focused task in Tree View (watcher-ery) ([6800880](https://github.com/ghchinoy/watcher/commit/6800880bbf130061600dfab703b19315860b3649))
* b7o a11y+security slice — symlink-safe AI scratch files (SEC-04), semantic buttons (A11Y-01), modal focus traps (A11Y-02) ([6d3ce5c](https://github.com/ghchinoy/watcher/commit/6d3ce5c27a04e1cdeacb304c5b657dca3fba0bb6))
* r1f concurrency slice — optimistic concurrency compare-and-swap (RACE-03) ([60f6558](https://github.com/ghchinoy/watcher/commit/60f65582549262cb4ea36c1130719ba1401219b6))
* r1f perf slice — O(1) dependency scan (REL-03), debounced daemon export (RACE-04), and robust PATH environment ([4883f92](https://github.com/ghchinoy/watcher/commit/4883f92ab0c0049a557b271450fa6368df3fc834))
* r1f polish batch — reusable components, contrast fixes, clean format, and test stability ([b742aab](https://github.com/ghchinoy/watcher/commit/b742aab9a8360ce5db39cca2501b0caa73508e27))
* REL-05 — graceful daemon crash (SIGKILL/-9) recovery and tests ([7e985e9](https://github.com/ghchinoy/watcher/commit/7e985e9d36e464e4d9dbf8deafb77fdaad4353fc))
* restore last active project on startup (watcher-w2a) ([7ca5597](https://github.com/ghchinoy/watcher/commit/7ca559719a73a1698d985de54d0a5b3f2a1953c0))
* surface mutation failures (REL-01) and restart hung daemon (REL-02) ([24bea20](https://github.com/ghchinoy/watcher/commit/24bea20737c60819f5287ef206c454087ed882ab))
* t60 phase 1 P0 security & concurrency blockers ([5e3df70](https://github.com/ghchinoy/watcher/commit/5e3df707a762aa87165627244bbe480c1a5d00f6))

## [0.9.0](https://github.com/ghchinoy/watcher/compare/agent_watcher-v0.8.0...agent_watcher-v0.9.0) (2026-06-30)


### Features

* add AppLogger structured logging, replace all debugPrint with levelled calls ([1f9bdd7](https://github.com/ghchinoy/watcher/commit/1f9bdd783028c5c70a80e4c79af6ee45b0128f9e))

## [0.8.0](https://github.com/ghchinoy/watcher/compare/agent_watcher-v0.7.0...agent_watcher-v0.8.0) (2026-06-29)


### Features

* add IssueDependencies model extension and fix inspector dependency labels ([1cb0533](https://github.com/ghchinoy/watcher/commit/1cb0533a551d4f801995100b36225767ff6048f2))
* full dependency visualization — ready queue, blocked view, graph, badges, authoring ([498d1bc](https://github.com/ghchinoy/watcher/commit/498d1bc87d5e934b26cc7e1b6ad4418ae04a1dd9))
* introduce configurable safety heartbeat and fix daemon subprocess executable PATH resolution ([4c916bc](https://github.com/ghchinoy/watcher/commit/4c916bcedc0900c2782177b89d490d232af45527))
* **tree_view:** add drag and drop reparenting ([0d3affb](https://github.com/ghchinoy/watcher/commit/0d3affb879af0fc4fc22589c6c72a96cdac2fcd1))
* trigger minor release for recent daemon and UI updates ([322afa6](https://github.com/ghchinoy/watcher/commit/322afa6d313ef1921fe5cf865f709b8e8c99ff3c))
* update default AI model to gemini-3.5-flash with versioned migration ([93ca822](https://github.com/ghchinoy/watcher/commit/93ca82201eaf0d918522c717d3b5f6d54de7b335))


### Bug Fixes

* always select newly added project immediately ([666b54e](https://github.com/ghchinoy/watcher/commit/666b54ef32557849c8843d6f4522fcac44405baa))
* **build:** disable SPM and update pods ([f68dd29](https://github.com/ghchinoy/watcher/commit/f68dd29939b40c738992ef58bf6b0c1677329700))
* **build:** remove swiftpm package references to resolve xcodebuild plugin loading crashes ([22bf2c9](https://github.com/ghchinoy/watcher/commit/22bf2c98e872631e0a769420e7943d2dd2fcdd28))
* correct relative path for zip artifact in release workflow ([f67b97b](https://github.com/ghchinoy/watcher/commit/f67b97b7390b3c3e669a9b692cd5714bce3a8ceb))
* **daemon:** Use dolt remotes for get_peers ([1b15c2b](https://github.com/ghchinoy/watcher/commit/1b15c2badb528af7231205b3f6aea4653c884833))
* ensure health check diagnostics marshals to empty array instead of null ([2060418](https://github.com/ghchinoy/watcher/commit/20604185df5f5623839928dab0bb17eb6a1d2d9b))
* preserve hierarchy for open subtasks of closed parents in tree view ([e6f011c](https://github.com/ghchinoy/watcher/commit/e6f011c6131dc86b1d8fc66d6c7468c7365d1eaf))
* remove nested MacosSheet from HealthCheckModal to fix layout and close button ([424dfc6](https://github.com/ghchinoy/watcher/commit/424dfc61257ff9e65a1c042e22cd3e53fc71e242))
* **ui:** Update interaction parsing to support new beads schema ([e3a9471](https://github.com/ghchinoy/watcher/commit/e3a9471bcc86bb99d8b4d48128525426bc086e84))
* update beads daemon interactions path ([0c5a7d5](https://github.com/ghchinoy/watcher/commit/0c5a7d5f939f6690931a762120aaeaf2ca9a400c))
* update ghostty applescript to use input text command ([8fe260a](https://github.com/ghchinoy/watcher/commit/8fe260aa63cad1d8d039b437fbd5a971c5e7865e))

## [0.7.0](https://github.com/ghchinoy/watcher/compare/agent_watcher-v0.6.1...agent_watcher-v0.7.0) (2026-04-28)


### Features

* add back button to settings screen and update widget tree architecture diagram ([382b931](https://github.com/ghchinoy/watcher/commit/382b931c56b110dfca5deaef252dc812599bd13e))
* add date to activity ticker timestamps for older projects ([7800e7c](https://github.com/ghchinoy/watcher/commit/7800e7c198a7321ca38dc40b85e1dfea33361ac8))
* add empty states and expand/collapse all to views ([c360672](https://github.com/ghchinoy/watcher/commit/c3606721e7863327137477036f7e9bc45137f9d8))
* add federation modal to configure remotes ([3906b65](https://github.com/ghchinoy/watcher/commit/3906b6531f3097e8f2257b47d79aca19503fc711))
* add global settings panel for configuring remote sync intervals ([1317866](https://github.com/ghchinoy/watcher/commit/1317866bedaac7aa97082a7057bf814eef22cefe))
* add robust issue comments timeline and input field to the issue inspector ([1b6efd2](https://github.com/ghchinoy/watcher/commit/1b6efd2991dfd05eb4bef113fdcfcb48811107e2))
* add UI toggles for closed tasks and custom bd path setting ([ff1aa3c](https://github.com/ghchinoy/watcher/commit/ff1aa3c6350cff7c9322067d5d715329b7cad6d1))
* add user identity configuration to settings and use it for issue updates ([1d0240c](https://github.com/ghchinoy/watcher/commit/1d0240c2e710eee90bfc925693f9224ee66054df))
* add user-facing retry button to project error states ([e604139](https://github.com/ghchinoy/watcher/commit/e6041398b183b06e308929678d0bcf65314d27fd))
* AI Terminal Orchestration and Native Issue Creation ([d1cdeeb](https://github.com/ghchinoy/watcher/commit/d1cdeeb74e744c1b7f29eb11930c80af5bdb6d09))
* bump embedded daemon to beads v0.61.0 and surface version in settings UI ([85ec3d1](https://github.com/ghchinoy/watcher/commit/85ec3d11d9b101966ce1f7131c2383f25e50e8f7))
* bump version to 0.2.0 and enhance UI/UX ([a70bd35](https://github.com/ghchinoy/watcher/commit/a70bd35dca601ab70f404c4c7dd62d583919ef7f))
* bump version to 0.3.0 and implement native AI integration ([586c82d](https://github.com/ghchinoy/watcher/commit/586c82dea77b80ed0df6a492baae7d5ec41aae32))
* complete standalone go daemon and dart client refactoring ([1083cc5](https://github.com/ghchinoy/watcher/commit/1083cc5671ab0fef830a5b8685d7861fd96f9751))
* display issue notes in the inspector panel ([c956706](https://github.com/ghchinoy/watcher/commit/c95670631ae90ae96c65604b9bb15a635b5499f7))
* implement background sync timer for federated projects ([94fc2c4](https://github.com/ghchinoy/watcher/commit/94fc2c4e05ae3e75c97112935d7427939bbd2bb2))
* implement federation remote rpc endpoints in daemon ([4ff2a2f](https://github.com/ghchinoy/watcher/commit/4ff2a2fc1b1385ab3d6568576f9677c9ae72ff08))
* implement macOS HIG compliance for Tree View ([0f2be4b](https://github.com/ghchinoy/watcher/commit/0f2be4b0deecdbc272ebd57666f5319f3b84967a))
* implement macOS HIG compliant unread blue dot indicators for sidebar projects based on background activity ([4135597](https://github.com/ghchinoy/watcher/commit/4135597314f69073ed03d20af7420dc79517c93a))
* implement manual project reordering in settings screen ([ebf7d26](https://github.com/ghchinoy/watcher/commit/ebf7d26fb723d344bb601f8a9e17904a5ae5a2e4))
* implement semantic activity ticker with graph-aware unblocked states and human-readable formatting ([16aa72a](https://github.com/ghchinoy/watcher/commit/16aa72a9c63a8405976e59a197345a4d3a00587e))
* initial release of macOS Watcher GUI ([9d2370b](https://github.com/ghchinoy/watcher/commit/9d2370b44f46aaa2e5a66aae82ec4339dca5e695))
* introduce interactive controls, AI integration, and code modularity ([6d2a72e](https://github.com/ghchinoy/watcher/commit/6d2a72e629393d10216703a1cdbca194a35475cf))
* project health diagnostics, settings modal, and dynamic AI config ([e112d04](https://github.com/ghchinoy/watcher/commit/e112d04c2076fc46d3b45e32a300e6cf7cdee25c))
* rearrange dashboard statistics and redesign widget tree diagram using material themes ([1bebce2](https://github.com/ghchinoy/watcher/commit/1bebce2a8530f9f7a2317a7b9168f752a0a2645b))
* replace sidebar project icons with contextual recent activity timestamps ([5468f05](https://github.com/ghchinoy/watcher/commit/5468f05e366d3fc061a2aed56b25ca110217c0a3))
* scaffold standalone go daemon and implement basic json-rpc graph fetch ([ee8881f](https://github.com/ghchinoy/watcher/commit/ee8881f2fae9e56c7b689e1df4d9532f4293a3f7))
* surface federation status and sync actions in UI ([d67a3ac](https://github.com/ghchinoy/watcher/commit/d67a3ac0ac9e29ffdbf49f1ba45847cbc58d1ad0))
* unlock unassigned kanban cards and add editable owner/assignee fields to inspector ([e23184d](https://github.com/ghchinoy/watcher/commit/e23184de6602bc827eeec0352ad3a0419f9d3526))
* upgrade dashboard stat cards into custom widgets and separate priority indicators ([d38467f](https://github.com/ghchinoy/watcher/commit/d38467fde87353bb14d5451dff30236584e50c71))
* upgrade to beads v1.0.3 and fix macOS execution pathing ([67fdb32](https://github.com/ghchinoy/watcher/commit/67fdb326a0e23252eaeab01c00959e9f667250c9))
* **versions:** implement daemon and CLI version monitoring ([1ac6401](https://github.com/ghchinoy/watcher/commit/1ac6401949dea8949f5cba7b6cb48c17e64edc6b))
* **versions:** implement upstream and project-specific version monitoring ([fd2eec2](https://github.com/ghchinoy/watcher/commit/fd2eec28d096cd333ae098aae0d58d782897f892))


### Bug Fixes

* attach explicit dependencies to issue payload in go daemon ([6c7dea9](https://github.com/ghchinoy/watcher/commit/6c7dea906022bc7fc2a3f48183838055ca8a4272))
* correctly parse and render implicit dot-notation parent dependencies in tree view ([258ff4d](https://github.com/ghchinoy/watcher/commit/258ff4d4c4ab418fdbcf79ade37790aa183bf1f5))
* correctly restore the comments section in the issue inspector UI ([7856f48](https://github.com/ghchinoy/watcher/commit/7856f48bbd6770b9c5058b34abffd5098ec0eac0))
* ensure discovered-from tasks are rendered in the tree view if they have no parent ([86783e0](https://github.com/ghchinoy/watcher/commit/86783e0de169e5fac74938d73a5fd0ef41aa6965))
* ensure watcher-daemon explicitly runs bd export after mutating the database to trigger file watchers and activity ticker updates ([add00ab](https://github.com/ghchinoy/watcher/commit/add00ab173fcd1a20dc78e697434ed8fdfee6060))
* explicit transparent colors to prevent Material hover states from destroying text contrast during dragging in dark mode ([0ae25c8](https://github.com/ghchinoy/watcher/commit/0ae25c8486293034cd10e5cb73b577813bc84fde))
* gracefully exit and return json error for uninitialized or locked projects instead of panicking ([2745b35](https://github.com/ghchinoy/watcher/commit/2745b35564aa6d35de950fd76244922b90f00f6d))
* prevent focus loss in settings screen by using persistent controllers ([65e3e03](https://github.com/ghchinoy/watcher/commit/65e3e03a8e145037aee92c824a31f24b32a6e771))
* prevent Unhandled Async Exceptions when daemon crashes ([20d7248](https://github.com/ghchinoy/watcher/commit/20d7248ef2422c0c5b8e16a2d0d52c0c0ca14b93))
* recursively render closed parent nodes if they contain open child tasks ([92c1b38](https://github.com/ghchinoy/watcher/commit/92c1b38bf7a00fe53b4d03ceb1e05b7c6dbbcc70))
* refactor AppState to maintain a single BeadsService daemon instance per project to prevent connection leaks ([75a2b65](https://github.com/ghchinoy/watcher/commit/75a2b658aa0a2e04f198d006f9665cacf7696f0a))
* replace linesplitter with custom string buffer accumulator to prevent json-rpc truncation on massive payloads ([f0ba71d](https://github.com/ghchinoy/watcher/commit/f0ba71dc92fe07093c22abeeab2f0669fb5cebcf))
* replace linesplitter with streaming json decoder ([09fa8f5](https://github.com/ghchinoy/watcher/commit/09fa8f5d2cc2d0515aa03bfea4ea4e30f4eca878))
* resolve build errors from missing context and curly braces ([d3d49db](https://github.com/ghchinoy/watcher/commit/d3d49db78aa9c001e2fa5082813d881d1e3bcd65))
* resolve CocoaPods xcconfig build errors to enable transparent title bars via macos_window_utils ([8c081d2](https://github.com/ghchinoy/watcher/commit/8c081d240a17f7ff6070ac09b9f95a18f584be29))
* resolve daemon pathing and prevent socket exception crashes ([cb51101](https://github.com/ghchinoy/watcher/commit/cb511019f858f1d4b564e874451ce08f76e86890))
* resolve macOS Gatekeeper and AMFI crash on launch ([1b90059](https://github.com/ghchinoy/watcher/commit/1b90059fd2588032cf2430ce133181267352019d))
* resolve modal translucency artifacts and add daemon timeout to prevent orphaned rpc crashes ([675d433](https://github.com/ghchinoy/watcher/commit/675d4337cf5e6f12d777ed0ed146d80a99185755))
* retrieve federation remote directly from config.yaml to avoid unexported dependency issues ([a8661a6](https://github.com/ghchinoy/watcher/commit/a8661a6c5efa3263cadfc044806e84bcf0e2dc70))
* revert to LineSplitter for proper JSON-RPC stream framing ([b564008](https://github.com/ghchinoy/watcher/commit/b564008103afc3e5bfd1594355a3fbbb4183fcba))
* route sync_peer to beads SyncStore implementation ([310241a](https://github.com/ghchinoy/watcher/commit/310241a47e1e9ef87e8dc658fddafb5d0d66b8ea))
* serialize fatal daemon initialization errors to prevent json-rpc stream corruption ([6434399](https://github.com/ghchinoy/watcher/commit/64343990f0eb32f665b112ba2855fd43fd31a9c2))
* shell out to bd dolt killall before opening database to resolve lock contention ([30f88a6](https://github.com/ghchinoy/watcher/commit/30f88a6a67776731acb1d33a75dfbafdf3cdbfca))
* shell out to bd federation sync to handle gs:// driver registration and auth ([4d75e90](https://github.com/ghchinoy/watcher/commit/4d75e90ad5c29e7bf872d852a0652ab8dfbf9db5))
* sidebar project selection mismatch when sorted ([5c7c8df](https://github.com/ghchinoy/watcher/commit/5c7c8dfe735e2c93f78a33f496f423493e5d553b))
* support 'discovered-from' dependency type in tree view ([49cfff4](https://github.com/ghchinoy/watcher/commit/49cfff4fa6950b66912de76779ca4b9e718cea17))
* update ActivityTicker to parse the modern backup/events.jsonl schema instead of obsolete interactions.jsonl ([d67d828](https://github.com/ghchinoy/watcher/commit/d67d8289bbaabb453a152f2b64159d4fb72cc3b0))
* use dynamic brew prefix for icu4c in Makefile ([6df7a44](https://github.com/ghchinoy/watcher/commit/6df7a448283a7263b88f1d04b3a563a60f0ba94a))
* wrap modals in MacosScaffold to properly resolve light/dark system themes ([ee32d0a](https://github.com/ghchinoy/watcher/commit/ee32d0afde4f77b80fe3458de64f77ade5074c7d))
