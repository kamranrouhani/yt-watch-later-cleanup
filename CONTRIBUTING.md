# Contributing

## Running the tests

```bash
npm install
npm test              # unit and guard tests, Node, no browser
npm run test:browser  # real Chrome via Playwright, fake YouTube from fixtures
npm run test:all
```

`npm test` must be green before any commit. It must never launch a browser;
the browser harness is scoped out of it by path.

## Loading the extension

`chrome://extensions`, enable developer mode, "Load unpacked", select the
repository root. Open the dashboard from the toolbar icon.

## The no-network rule

All network access goes through `src/core/net.js`, and only to
`www.youtube.com` and `www.googleapis.com`. No other shipped file may call
`fetch`, `XMLHttpRequest`, `sendBeacon`, `WebSocket`, `EventSource`, dynamic
`import()` or `new Worker()`. No third-party script, font, stylesheet or image
is loaded, including from a CDN.

`test/no-network.test.js` enforces this by reading the shipped files. If a
change makes it fail, the test is right.

No analytics, crash reporting, update checks or remote config. This extension
sees someone's viewing habits; it stays local.

## Removal safety

Anything that can remove videos needs a test showing it cannot remove more
than the preview the user saw. Specifically:

- the executor only accepts a `setVideoId` list from a preview
- an empty or half-built rule matches nothing
- a condition on data that is missing is a non-match, never a match
- a protect rule beats every remove rule

A change that weakens one of these will not be merged, however convenient.

## Fixtures

- `test/fixtures/synthetic/`: hand-written minimal responses for unit tests
- `test/fixtures/captured/<date>/`: real InnerTube responses from a signed-in
  session

Before committing a capture, scrub it. Replace the account name, avatar URLs,
`visitorData`, `responseContext` tracking params, any cookie or token, and the
titles and channels of anything personal with obvious placeholders. Keep the
structure, remove the person. Note what the capture covers in the directory's
README. Raw, unscrubbed captures go under a `raw/` subdirectory, which is
gitignored.

## Code style

- Plain browser JavaScript, no transpiler, no bundler, no runtime
  dependencies.
- Modules under `src/core/` attach to a global `WLCore` and also export via
  `module.exports`. Follow the existing wrapper pattern.
- A new injected file must be added to `manifest.json`; `test/wiring.test.js`
  fails otherwise.
- English user-facing strings, code and comments.
- No comments by default. Prefer clearer names and smaller functions. A
  comment earns its place only when it records a constraint the code cannot
  express, such as why a magic InnerTube value is what it is.
- Code ported from `reference/upstream/` keeps working behaviour identical
  first and gets restructured second, in separate commits, so the port can be
  checked against the original.

## Tests come first

Write the failing test, watch it fail for the right reason, then make it
pass. Parser changes must be pinned by a fixture-backed test: the failure mode
is silently wrong data driving a deletion, not an exception.

## Workflow

- One issue, one branch, one pull request. Branches are named
  `feature/NNNN-<slug>` or `fix/NNNN-<slug>`, where `NNNN` is the issue
  number padded to four digits.
- The task folder for an issue uses the same number: issue #5 is
  `tasks/0005-<slug>/`. The `blocked` label means the issue has an open
  dependency, and comes off when the last one closes.
- The PR says `Closes #<issue>` and is merged with a regular merge commit,
  never squashed.
- Each issue lists its acceptance criteria. The PR is ready when every one is
  demonstrated, with the command and its output.

## Commits

Plain, direct, imperative. Lowercase, no trailing period on the subject.
Explain why when it is not obvious from the diff; many good commits are one
line. No emoji, no section headers, no generated trailers or attribution
footers.

## Task documentation

Non-trivial work is organised under `tasks/NNNN-slug/` with `plans/`,
`implementation/` and `reviews/`. Plans are never edited once work starts; a
changed approach means a new dated plan that says what it supersedes. Progress
logs are append-only and record the approaches that failed, not just the one
that worked. Task files are committed separately from the code they describe.
