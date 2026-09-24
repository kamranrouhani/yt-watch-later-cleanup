# yt-watch-later-cleanup

A Chrome extension for cleaning up a YouTube Watch Later playlist that has
grown past the point of being useful.

It reads the whole playlist, shows it in a dashboard, lets you describe what
should go ("everything I have finished", "every football video older than the
last 200 I added", "anything from this channel", "videos that were deleted or
made private"), previews exactly which videos match, and then removes them in
batches.

Status: in development. Nothing here is usable yet. See
[ROADMAP.md](ROADMAP.md) and the open issues.

## How the work is organised

Issues run one at a time through an autonomous pipeline: a kanban board
picks each open issue up in a fresh agent session (implementation in a
git worktree, then a code review, then a merge once CI is green). The
rules, the issue/card sync conventions and the guardrails against two
sessions colliding are in [docs/ORCHESTRATION.md](docs/ORCHESTRATION.md).
Branch protection on `main` requires the `test` check, so nothing merges
with a red suite.

## Try it

1. Clone the repository.
2. Open `chrome://extensions` and turn on developer mode.
3. Click "Load unpacked" and select the repository root.
4. Click the toolbar icon. The dashboard opens in a tab.

For now the dashboard is an empty page with a heading. It does not talk to
YouTube yet.

## Why this exists

Watch Later has a hard size limit and no real tooling. YouTube offers one bulk
action, "Remove watched videos", and it removes anything you so much as
started. Google removed Watch Later from the public Data API in 2016, so no
ordinary API client can read or edit it either.

What this adds over the tools that already exist:

- **Rules, not a single button.** Combine watch progress, channel, topic,
  position in the list, duration, title keywords and availability.
- **Protection wins.** A protect rule ("never touch anything from these
  channels", "never touch anything I have not started") overrides every
  delete rule.
- **Dry run first, always.** Every run shows the exact list of videos it will
  remove before it removes anything, and keeps a record of what it removed.
- **Topics, not just categories.** YouTube's category for a football video is
  "Sports", shared with everything from F1 to gym content. The extension also
  reads the per-video topic classification, which does separate football from
  other sport.

The research behind these choices, including what already exists and why it
was not enough, is in [docs/RESEARCH.md](docs/RESEARCH.md).

## How it works

Watch Later is only reachable through the internal endpoints YouTube's own web
client uses. The extension calls them from a youtube.com tab where you are
already signed in, exactly as the web page itself does. It never sees or
stores your password, and it never talks to any server other than YouTube and
Google's public YouTube Data API.

Topic lookups use the public Data API with an API key you create yourself. They
read public video metadata by video ID, which is allowed, and cost roughly one
percent of the free daily quota for a full 5,000 video playlist. The topic
filter is optional; everything else works without a key.

Design detail is in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Caveats

This relies on undocumented YouTube internals. They have been stable for years
because YouTube's own site depends on them, but they carry no guarantee and
can change without notice. The dry run and the removal log exist because of
that, not in spite of it.

Watch progress comes from your YouTube watch history. If history is paused, or
you watched something signed out, the extension cannot know you saw it.

## Credits

The InnerTube client, the playlist parsing, the oldest-first sort handling and
the removal call were ported from
[yt-watch-later-tools](https://github.com/JadenJSJ/yt-watch-later-tools) by
JadenJSJ, a userscript that removes the oldest N videos from Watch Later. Its
source and MIT licence notice are kept unmodified in
[reference/upstream/](reference/upstream/).

## Licence

MIT. See [LICENSE](LICENSE).
