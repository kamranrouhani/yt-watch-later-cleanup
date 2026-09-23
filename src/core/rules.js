'use strict';

(function (root) {
  const ruleModel = root.WLCore && root.WLCore.ruleModel
    ? root.WLCore.ruleModel
    : require('./ruleModel.js');
  const { FIELDS } = ruleModel;

  const OPERATOR_TAKES_NO_VALUE = new Set(['== 0', 'is-false', 'is-true']);

  function valueKindFor(field, operator) {
    if (OPERATOR_TAKES_NO_VALUE.has(operator)) return 'none';
    return FIELDS[field].value;
  }

  function compileCondition(condition) {
    const { field, operator, value } = condition;
    const needsNoValue = valueKindFor(field, operator) === 'none';

    function isMissing(entry) {
      if (field === 'topic' || field === 'categoryId') return true;
      const v = entry[field];
      return v === undefined || v === null;
    }

    function test(entry) {
      if (isMissing(entry)) return 'missing';
      switch (`${field}:${operator}`) {
        case 'watchedPercent:>=': return entry.watchedPercent >= value;
        case 'watchedPercent:<': return entry.watchedPercent < value;
        case 'watchedPercent:== 0': return entry.watchedPercent === 0;
        case 'channelId:in': return value.includes(entry.channelId);
        case 'channelId:not-in': return !value.includes(entry.channelId);
        case 'position:among-oldest': return entry.position <= value;
        case 'durationSeconds:>=': return entry.durationSeconds >= value;
        case 'durationSeconds:<': return entry.durationSeconds < value;
        case 'title:contains': return entry.title.toLowerCase().includes(value.toLowerCase());
        case 'title:matches-regex': return new RegExp(value).test(entry.title);
        case 'playable:is-false': return entry.playable === false;
        case 'isShort:is-true': return entry.isShort === true;
        default: return false;
      }
    }

    return { test };
  }

  function compileRule(rule) {
    const conditions = (rule.conditions || []).map(compileCondition);
    return {
      test(entry) {
        let sawMissing = false;
        for (const condition of conditions) {
          const outcome = condition.test(entry);
          if (outcome === 'missing') sawMissing = true;
          if (outcome !== true) return { matched: false, sawMissing };
        }
        return { matched: conditions.length > 0, sawMissing };
      },
    };
  }

  function evaluate(ruleSet, entries) {
    const removeRules = (ruleSet.remove || []).map(compileRule);
    const protectRules = (ruleSet.protect || []).map(compileRule);
    const remove = [];
    const protectedEntries = [];
    const skipped = new Set();

    for (const entry of entries) {
      let winningRemove = null;
      let winningRemoveIndex = -1;
      let removeSawMissing = false;
      for (let i = 0; i < removeRules.length; i += 1) {
        const outcome = removeRules[i].test(entry);
        if (outcome.sawMissing) removeSawMissing = true;
        if (outcome.matched) {
          winningRemove = ruleSet.remove[i];
          winningRemoveIndex = i;
          break;
        }
      }
      if (!winningRemove) {
        if (removeSawMissing) skipped.add(entry);
        continue;
      }

      let winningProtect = null;
      let protectSawMissing = false;
      for (let i = 0; i < protectRules.length; i += 1) {
        const outcome = protectRules[i].test(entry);
        if (outcome.sawMissing) protectSawMissing = true;
        if (outcome.matched) {
          winningProtect = ruleSet.protect[i];
          break;
        }
      }
      if (winningProtect) {
        protectedEntries.push({ entry, matchedRule: winningProtect });
      } else {
        if (removeSawMissing || protectSawMissing) skipped.add(entry);
        remove.push({ entry, matchedRule: winningRemove });
      }
    }

    return { remove, protected: protectedEntries, skippedMissingData: skipped.size };
  }

  const api = { evaluate, validate: ruleModel.validate, FIELDS: ruleModel.FIELDS };

  root.WLCore = Object.assign(root.WLCore || {}, { rules: api });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
