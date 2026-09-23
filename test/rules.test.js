'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { evaluate, validate } = require('../src/core/rules.js');

function entry(overrides = {}) {
  return {
    setVideoId: 'S1', videoId: 'v1', position: 1, title: 'A video',
    channelName: 'Chan', channelId: 'UC1', durationSeconds: 600,
    watchedPercent: 0, playable: true, unavailableReason: null,
    publishedText: '3 years ago', isShort: false, isLive: false,
    enrichment: null,
    ...overrides,
  };
}

const RULE = (conditions) => ({ conditions });

function ruleSet(remove, protect = []) {
  return { version: 1, remove, protect };
}

// Safety first: these four are written before any implementation exists.

test('safety: protect beats remove, for every condition type', () => {
  const removeRules = [
    RULE([{ field: 'watchedPercent', operator: '>=', value: 90 }]),
    RULE([{ field: 'channelId', operator: 'in', value: ['UC1'] }]),
    RULE([{ field: 'position', operator: 'among-oldest', value: 5 }]),
    RULE([{ field: 'durationSeconds', operator: '<', value: 60 }]),
    RULE([{ field: 'title', operator: 'contains', value: 'video' }]),
    RULE([{ field: 'title', operator: 'matches-regex', value: '^A' }]),
    RULE([{ field: 'playable', operator: 'is-false' }]),
    RULE([{ field: 'isShort', operator: 'is-true' }]),
  ];
  const protectRules = [
    RULE([{ field: 'channelId', operator: 'in', value: ['UC1'] }]),
    RULE([{ field: 'watchedPercent', operator: '<', value: 90 }]),
    RULE([{ field: 'position', operator: 'among-oldest', value: 1 }]),
    RULE([{ field: 'title', operator: 'contains', value: 'video' }]),
  ];
  const entries = [
    entry({ watchedPercent: 100 }),
    entry({ channelId: 'UC1' }),
    entry({ playable: false }),
    entry({ isShort: true, durationSeconds: 30 }),
  ];
  const result = evaluate(ruleSet(removeRules, protectRules), entries);
  assert.deepStrictEqual(result.remove, []);
  assert.strictEqual(result.protected.length, entries.length);
});

test('safety: a rule with no conditions matches nothing, and no remove rules removes nothing', () => {
  const halfBuilt = evaluate(ruleSet([RULE([])]), [entry()]);
  assert.deepStrictEqual(halfBuilt.remove, []);
  assert.deepStrictEqual(halfBuilt.protected, []);

  const noRemove = evaluate(ruleSet([], [RULE([{ field: 'title', operator: 'contains', value: 'video' }])]), [entry()]);
  assert.deepStrictEqual(noRemove.remove, []);
  assert.deepStrictEqual(noRemove.protected, []);
});

test('safety: a condition on a missing field is a non-match, counted as skipped', () => {
  const rules = ruleSet([RULE([
    { field: 'durationSeconds', operator: '>=', value: 300 },
  ])]);
  const result = evaluate(rules, [
    entry({ durationSeconds: null }),
    entry({ durationSeconds: 600 }),
  ]);
  assert.deepStrictEqual(result.remove.map((r) => r.entry.durationSeconds), [600]);
  assert.strictEqual(result.skippedMissingData, 1);
});

test('safety: topic and category conditions never match and always count as skipped', () => {
  const rules = ruleSet([RULE([
    { field: 'topic', operator: 'has-any-of', value: ['Association_football'] },
  ])]);
  const result = evaluate(rules, [
    entry({ enrichment: { topics: ['Association_football'] } }),
    entry({ enrichment: null }),
  ]);
  assert.deepStrictEqual(result.remove, []);
  assert.strictEqual(result.skippedMissingData, 2);
});

// Functional matrix

test('watchedPercent operators', () => {
  const entries = [
    entry({ watchedPercent: 0 }), entry({ watchedPercent: 37 }),
    entry({ watchedPercent: 90 }), entry({ watchedPercent: 100 }),
  ];
  assert.deepStrictEqual(
    evaluate(ruleSet([RULE([{ field: 'watchedPercent', operator: '>=', value: 90 }])]), entries).remove.map((r) => r.entry.watchedPercent),
    [90, 100],
  );
  assert.deepStrictEqual(
    evaluate(ruleSet([RULE([{ field: 'watchedPercent', operator: '<', value: 90 }])]), entries).remove.map((r) => r.entry.watchedPercent),
    [0, 37],
  );
  assert.deepStrictEqual(
    evaluate(ruleSet([RULE([{ field: 'watchedPercent', operator: '== 0', value: null }])]), entries).remove.map((r) => r.entry.watchedPercent),
    [0],
  );
});

test('channelId in and not-in', () => {
  const entries = [entry({ channelId: 'UC1' }), entry({ channelId: 'UC2' })];
  assert.deepStrictEqual(
    evaluate(ruleSet([RULE([{ field: 'channelId', operator: 'in', value: ['UC1'] }])]), entries).remove.map((r) => r.entry.channelId),
    ['UC1'],
  );
  assert.deepStrictEqual(
    evaluate(ruleSet([RULE([{ field: 'channelId', operator: 'not-in', value: ['UC1'] }])]), entries).remove.map((r) => r.entry.channelId),
    ['UC2'],
  );
});

test('position among-oldest matches at the boundary and past it', () => {
  const entries = [1, 2, 3, 4, 5].map((position) => entry({ position }));
  const result = evaluate(ruleSet([RULE([{ field: 'position', operator: 'among-oldest', value: 3 }])]), entries);
  assert.deepStrictEqual(result.remove.map((r) => r.entry.position), [1, 2, 3]);
});

test('durationSeconds operators, with live entries always missing', () => {
  const entries = [
    entry({ durationSeconds: 59 }), entry({ durationSeconds: 60 }),
    entry({ durationSeconds: null, isLive: true }),
  ];
  assert.deepStrictEqual(
    evaluate(ruleSet([RULE([{ field: 'durationSeconds', operator: '<', value: 60 }])]), entries).remove.map((r) => r.entry.durationSeconds),
    [59],
  );
  const result = evaluate(ruleSet([RULE([{ field: 'durationSeconds', operator: '>=', value: 60 }])]), entries);
  assert.deepStrictEqual(result.remove.map((r) => r.entry.durationSeconds), [60]);
  assert.strictEqual(result.skippedMissingData, 1);
});

test('title contains is case-insensitive, regex works and flags are stripped', () => {
  const entries = [entry({ title: 'Football highlights' }), entry({ title: 'cooking' })];
  assert.deepStrictEqual(
    evaluate(ruleSet([RULE([{ field: 'title', operator: 'contains', value: 'FOOTBALL' }])]), entries).remove.map((r) => r.entry.title),
    ['Football highlights'],
  );
  assert.deepStrictEqual(
    evaluate(ruleSet([RULE([{ field: 'title', operator: 'matches-regex', value: 'cook.*' }])]), entries).remove.map((r) => r.entry.title),
    ['cooking'],
  );
  const twice = [...entries, entry({ title: 'cooking' })];
  assert.deepStrictEqual(
    evaluate(ruleSet([RULE([{ field: 'title', operator: 'matches-regex', value: 'cook' }])]), twice).remove.map((r) => r.entry.title),
    ['cooking', 'cooking'],
  );
});

test('playable is-false and isShort is-true', () => {
  const entries = [
    entry({ playable: true }), entry({ playable: false, unavailableReason: '[Private video]' }),
    entry({ isShort: true, durationSeconds: 45 }),
  ];
  assert.deepStrictEqual(
    evaluate(ruleSet([RULE([{ field: 'playable', operator: 'is-false' }])]), entries).remove.map((r) => r.entry.playable),
    [false],
  );
  assert.deepStrictEqual(
    evaluate(ruleSet([RULE([{ field: 'isShort', operator: 'is-true' }])]), entries).remove.map((r) => r.entry.isShort),
    [true],
  );
});

test('conditions in one rule join with AND, rules join with OR', () => {
  const entries = [
    entry({ watchedPercent: 100, channelId: 'UC1' }),
    entry({ watchedPercent: 100, channelId: 'UC2' }),
    entry({ watchedPercent: 10, channelId: 'UC1' }),
  ];
  const result = evaluate(ruleSet([RULE([
    { field: 'watchedPercent', operator: '>=', value: 90 },
    { field: 'channelId', operator: 'in', value: ['UC1'] },
  ])]), entries);
  assert.deepStrictEqual(result.remove.map((r) => r.entry.channelId), ['UC1']);

  const either = evaluate(ruleSet([
    RULE([{ field: 'watchedPercent', operator: '>=', value: 90 }]),
    RULE([{ field: 'channelId', operator: 'in', value: ['UC1'] }]),
  ]), entries);
  assert.strictEqual(either.remove.length, 3);
});

test('among-oldest counts only entries passing the other conditions of the same rule', () => {
  const entries = [
    entry({ position: 1, watchedPercent: 0 }),
    entry({ position: 2, watchedPercent: 0 }),
    entry({ position: 3, watchedPercent: 95 }),
    entry({ position: 4, watchedPercent: 0 }),
  ];
  const result = evaluate(ruleSet([RULE([
    { field: 'position', operator: 'among-oldest', value: 3 },
    { field: 'watchedPercent', operator: '<', value: 90 },
  ])]), entries);
  assert.deepStrictEqual(result.remove.map((r) => r.entry.position), [1, 2]);
});

test('the readme example: finished or football older than the newest 200, never these channels', () => {
  const entries = [
    entry({ position: 1, watchedPercent: 100, channelId: 'UCkeep' }),
    entry({ position: 2, watchedPercent: 100, channelId: 'UCother' }),
    entry({ position: 3, watchedPercent: 5, channelId: 'UCother' }),
    entry({ position: 5, watchedPercent: 0, channelId: 'UCother', enrichment: { topics: ['Association_football'] } }),
    entry({ position: 250, watchedPercent: 0, channelId: 'UCother', enrichment: { topics: ['Cooking'] } }),
  ];
  const result = evaluate(ruleSet(
    [
      RULE([{ field: 'watchedPercent', operator: '>=', value: 90 }]),
      RULE([
        { field: 'topic', operator: 'has-any-of', value: ['Association_football'] },
        { field: 'position', operator: 'among-oldest', value: 200 },
      ]),
    ],
    [RULE([{ field: 'channelId', operator: 'in', value: ['UCkeep'] }])],
  ), entries);
  assert.deepStrictEqual(result.remove.map((r) => r.entry.position), [2]);
  assert.deepStrictEqual(result.protected.map((r) => r.entry.position), [1]);
  assert.strictEqual(result.skippedMissingData, 3);
});

test('matchedRule points at the winning rule', () => {
  const rules = ruleSet([
    RULE([{ field: 'watchedPercent', operator: '>=', value: 90 }]),
    RULE([{ field: 'isShort', operator: 'is-true' }]),
  ]);
  const result = evaluate(rules, [
    entry({ watchedPercent: 100 }),
    entry({ isShort: true }),
  ]);
  assert.strictEqual(result.remove[0].matchedRule, rules.remove[0]);
  assert.strictEqual(result.remove[1].matchedRule, rules.remove[1]);
});

test('validation accepts a good set and rejects each kind of problem', () => {
  assert.deepStrictEqual(validate(ruleSet([RULE([{ field: 'title', operator: 'contains', value: 'x' }])])), { ok: true, errors: [] });

  const problems = [
    [ruleSet([RULE([{ field: 'nope', operator: 'contains', value: 'x' }])]), 'unknown field'],
    [ruleSet([RULE([{ field: 'title', operator: 'nope', value: 'x' }])]), 'unknown operator'],
    [ruleSet([RULE([{ field: 'title', operator: 'contains', value: 5 }])]), 'value'],
    [ruleSet([RULE([{ field: 'channelId', operator: 'in', value: 'UC1' }])]), 'array'],
    [ruleSet([RULE([{ field: 'title', operator: 'matches-regex', value: '(unclosed' }])]), 'regex'],
    [{ version: 2, remove: [], protect: [] }, 'version'],
    [{ version: 1, remove: [], protect: [], extra: 1 }, 'unknown key'],
    [ruleSet([RULE([{ field: 'watchedPercent', operator: '>=', value: 'ninety' }])]), 'number'],
  ];
  for (const [bad, hint] of problems) {
    const result = validate(bad);
    assert.strictEqual(result.ok, false, `${hint} should fail`);
    assert.ok(result.errors.length > 0, `${hint} needs an error`);
    assert.ok(result.errors.every((e) => typeof e === 'string' && e.length > 0), `${hint} errors must be readable`);
  }
});

test('validation errors name the rule and condition indexes', () => {
  const result = validate(ruleSet([
    RULE([{ field: 'title', operator: 'contains', value: 'ok' }]),
    RULE([
      { field: 'title', operator: 'contains', value: 'ok' },
      { field: 'nope', operator: 'contains', value: 'x' },
    ]),
  ]));
  assert.strictEqual(result.ok, false);
  assert.match(result.errors[0], /remove rule 2, condition 2/);
});

test('a rule set round trips through json unchanged', () => {
  const rules = ruleSet(
    [RULE([{ field: 'watchedPercent', operator: '>=', value: 90 }, { field: 'title', operator: 'matches-regex', value: '^A' }])],
    [RULE([{ field: 'channelId', operator: 'in', value: ['UC1', 'UC2'] }])],
  );
  assert.deepStrictEqual(JSON.parse(JSON.stringify(rules)), rules);
  assert.deepStrictEqual(validate(JSON.parse(JSON.stringify(rules))), { ok: true, errors: [] });
});

test('evaluate on an empty entries list returns empty results', () => {
  const result = evaluate(ruleSet([RULE([{ field: 'title', operator: 'contains', value: 'x' }])]), []);
  assert.deepStrictEqual(result, { remove: [], protected: [], skippedMissingData: 0 });
});
