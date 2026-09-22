# Roadmap

Work is tracked as GitHub issues grouped into milestones. This file is the
overview; the issues are the source of truth for scope and acceptance
criteria.

## Sprint 1: scan, rules, preview, remove

The smallest version that does the job end to end, for every criterion that
needs no API key.

- **Foundation.** Extension scaffold, test runner, CI, wiring and no-network
  guard tests.
- **Capture spike.** Real InnerTube responses from a signed-in session,
  scrubbed into fixtures. Settles the open questions in
  [docs/RESEARCH.md](docs/RESEARCH.md) before anything depends on them.
- **Core, ported from upstream.** Request signing, InnerTube client, playlist
  parser with watch progress, full scanner with verified oldest-first sort,
  batched remover.
- **Rules engine.** Remove and protect rules over watch progress, channel,
  position, duration, title, availability and Shorts.
- **Dashboard.** Connects to a YouTube tab, scans, shows every video in a
  table, builds rules, previews exactly what a run would remove, runs it with
  a confirmation, progress and stop, and logs every removal.
- **Browser harness.** The whole flow in real Chrome against a fake YouTube
  served from the captured fixtures.
- **Live run.** One real cleanup on a real account, following a written
  checklist.

## Sprint 2: topics and quality of life

- **Data API enrichment.** User supplied API key, `videos.list` in batches of
  50, per-video cache, quota counter.
- **Topic and category rules.** "Only football", "no gaming", with presets.
- **Added-date import.** Read Google Takeout's Watch Later CSV to get real
  added-at dates, if the capture spike confirms InnerTube does not expose
  them.
- **Rule presets as files.** Export and import rule sets as JSON.

## Later, unscheduled

- Move instead of remove: send matching videos to a named playlist.
- Firefox build.
- Chrome Web Store listing.
