# Progress: 2026-09-23-tab-bridge

Append only. One entry at the end of every plan step. Never rewrite, reorder
or delete an entry, including the ones recording a mistake.

Entry shape:

    ## YYYY-MM-DD HH:MM  Step N: <step name as the plan writes it>

    Worked: <what landed>
    Did not work: <what was tried and failed, and why. Omit only if nothing failed>
    Verification: <command and what it actually printed>
    Next: <next step>

Take the timestamp from `date '+%Y-%m-%d %H:%M'`.

<!-- append entries below this line -->

## 2026-09-23 14:46  Step 1: Plan

Worked: plan and this log, from main at 70d2315.
Next: step 2, unit tests first.

## 2026-09-23 15:09  Steps 2 to 4: tests, modules, browser spec

Worked: unit tests for the nonce gate, relay, double injection, tab bridge
request/response, TabGoneError, timeout. Then content/bridge.js,
content/page.js, src/core/tabBridge.js, manifest content scripts, the
wiring assertion for the MAIN world js list, and
test/browser/bridge.spec.js: routed fake YouTube, hello handshake, ping
round trip through both worlds, a signed browseWatchLater, and the
tab-closed rejection. 119 unit tests, 6 browser assertions, all green.
Found, all logged:
- The real host cannot load youtube.com without a consent redirect
  (consent.youtube.com from this egress IP), so the routed fake page is the
  only way to exercise injection here. The real ping is on the manual
  checklist.
- Isolated world globals are invisible from the page world: my first
  assertion peeked at the wrong world. The observable for the handshake is
  page.js setting __wlReady after taking the nonce.
- addScriptTag on an extension page violates its CSP; the dashboard now
  loads tabBridge.js properly in dashboard.html, which it needs anyway.
- A double-escaped \\d in the route regex made my own fake reject the
  signed request with 401.
- The last-route swap needed unrouteAll first; Playwright times:1 routes
  stack behind the earlier catch-all.
- The expected TabGoneError shows up as a dashboard pageerror by design;
  the noise check now filters exactly that message.
Rough edge in my own bite tooling, again: a backup made after the bite
already modified the file, and a restore from a stale backup, left the
nonce guard off and two tests red. Caught by the suite, repaired by patch,
redone with correct ordering. The bites then proved: page accepting any
nonce, page double injection, bridge double injection.
Also: test:browser briefly chained capture.spec.js, which lives on the
#3 branch, not main. Scoped it to the specs that exist here; #3 will add
its own.
Verification: `npm test` `# tests 119`, `# pass 119`;
`npm run test:browser` exit 0 with 6 ok lines; `npm run check` `all
files parse`.
Next: step 5, review, PR, merge.
