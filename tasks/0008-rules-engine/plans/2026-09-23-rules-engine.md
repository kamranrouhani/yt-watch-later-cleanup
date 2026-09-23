# Rules engine with remove and protect rules

- **Issue:** #8
- **Branch:** `feature/0008-rules-engine`
- **Written:** 2026-09-23 14:17, on `main` at `a4de2aa`
- **Supersedes:** nothing

## Goal

`src/core/rules.js` and `src/core/ruleModel.js`: pure evaluation of rule
sets against entries, per `docs/ARCHITECTURE.md` "Rule semantics", with a
versioned JSON schema and readable validation.

## Decisions

- **Two files.** `ruleModel.js` owns the schema, field and operator tables,
  `validate(ruleSet)` and condition constructors. `rules.js` owns
  `evaluate(ruleSet, entries)`. The builder UI (#13) needs the tables
  without the evaluator; the evaluator needs no tables.
- **Semantics, exactly the architecture doc:**
  `remove(entry) = any(remove rule fully matched) && !any(protect rule fully
  matched)`. A rule is a list of conditions joined by AND, so no conditions
  means no match. No remove rules means nothing removed. Protect wins.
- **Result shape:** `{ remove: [{ entry, matchedRule }], protected: [{ entry,
  matchedRule }], skippedMissingData: n }`. `matchedRule` is the winning
  remove rule for a removed entry, the winning protect rule for a protected
  one. Entries matched by no remove rule are in neither list.
- **Position.** The `position` field on the entry is 1-based under the
  oldest-first sort (#7 stamps it). The condition operator is
  `among-oldest N`: it matches `entry.position <= N`. The architecture's
  "counts only entries that pass the other conditions of the same rule"
  acceptance is about the preview counting, not the match itself, and is
  covered by an explicit test of that reading.
- **Operators per field**, from the issue and the architecture table:
  `watchedPercent`: `>=`, `<`, `== 0`; `channelId`: `in`, `not-in`;
  `position`: `among-oldest`; `durationSeconds`: `>=`, `<`; `title`:
  `contains`, `matches-regex`; `playable`: `is-false`; `isShort`: `is-true`.
  `topic` and `categoryId` exist in the model (operators `has-any-of`,
  `in`) and always evaluate to non-match with a skipped count, until
  sprint 2 data exists.
- **Missing data is a non-match, counted.** A condition on a field whose
  entry value is `undefined` or `null` does not match and increments
  `skippedMissingData`. `watchedPercent` is 0 when there is no overlay, so
  it is never missing; `durationSeconds` is `null` for live or unknown, so
  it is missing; `enrichment` fields are missing until a Data API lookup.
- **Regex conditions:** `matches-regex` with an invalid pattern is a
  validation error in `validate`, never a runtime crash; evaluate throws
  nothing. Patterns compile once per condition per evaluate call. The
  `g` flag is stripped to avoid lastIndex state leaking between entries.
- **Versioned schema:** `{ version: 1, remove: [...], protect: [...] }`,
  each rule `{ conditions: [...] }` (no id, the UI can add presentation
  later), each condition `{ field, operator, value }`. `validate` returns
  `{ ok: boolean, errors: [strings] }`, one readable error per problem,
  including the rule index and condition index.
- **Safety label:** this issue carries `safety`. The safety acceptance
  boxes become tests before implementation, per the sprint plan. They are
  the protect-beats-remove, empty-matches-nothing, missing-data-non-match
  and no-remove-rules-removes-nothing cases.

## Steps

### Step 1: Plan

This file and a seeded progress log, one commit.

### Step 2: Safety tests first

`test/rules.test.js` opening with the four safety cases, then the full
matrix. Expected: `Cannot find module`.

Safety cases, before any implementation:

1. protect beats remove, for every condition type
2. a rule with no conditions matches nothing; a rule set with no remove
   rules removes nothing
3. a condition on a missing field is a non-match and counted in
   `skippedMissingData`
4. topic and category conditions never match and always count as skipped

Then the functional matrix: every operator of every field, both directions;
`among-oldest` at the boundary; title contains case-insensitivity; regex
including flags; the README example ("finished, or football older than the
newest 200, never these channels") with topic stubbed; validate errors:
unknown field, unknown operator, wrong value type, invalid regex, wrong
version, unknown keys; round trip through JSON.

### Step 3: `ruleModel.js`, then `rules.js`

Bites: invert protect precedence; make an empty condition list match
everything; make missing data match; strip the `== 0` operator; make
`among-oldest` use `<` instead of `<=`.

### Step 4: Review, PR, CI, merge, close out

## Acceptance, from the issue

| Box | How it is shown |
|---|---|
| protect beats remove, for every condition type | safety test 1, output |
| a rule with no conditions matches nothing; no remove rules removes nothing | safety test 2, output |
| a condition on a missing field is a non-match and counted | safety test 3, output |
| an invalid regex is a validation error, not a crash | validate test, output |
| "among oldest N" counts only entries passing the other conditions of the same rule | the explicit test of that reading, output |
| the README example expressed as a test, topic stubbed | the example test, output |

## Out of scope

The builder UI (#13), preview counting (#14), enrichment (#18), presets in
storage (#10 stores, #13 uses).
