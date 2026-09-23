'use strict';

(function (root) {
  const SCHEMA_VERSION = 1;

  const FIELDS = {
    watchedPercent: { value: 'number', operators: ['>=', '<', '== 0'] },
    channelId: { value: 'stringArray', operators: ['in', 'not-in'] },
    position: { value: 'positiveInteger', operators: ['among-oldest'] },
    durationSeconds: { value: 'number', operators: ['>=', '<'] },
    title: { value: 'string', operators: ['contains', 'matches-regex'] },
    playable: { value: 'none', operators: ['is-false'] },
    isShort: { value: 'none', operators: ['is-true'] },
    topic: { value: 'stringArray', operators: ['has-any-of'], enrichment: true },
    categoryId: { value: 'stringArray', operators: ['in'], enrichment: true },
  };

  const TOP_LEVEL_KEYS = new Set(['version', 'remove', 'protect']);

  function conditionError(listPath, ruleIndex, conditionIndex, message) {
    return `${listPath} rule ${ruleIndex + 1}, condition ${conditionIndex + 1}: ${message}`;
  }

  const OPERATOR_TAKES_NO_VALUE = new Set(['== 0', 'is-false', 'is-true']);

  function checkValue(kind, value) {
    switch (kind) {
      case 'string': return typeof value === 'string' && value.length > 0;
      case 'stringArray': return Array.isArray(value) && value.length > 0
        && value.every((v) => typeof v === 'string' && v.length > 0);
      case 'number': return typeof value === 'number' && Number.isFinite(value);
      case 'positiveInteger': return typeof value === 'number' && Number.isInteger(value) && value >= 1;
      case 'none': return value === null || value === undefined;
      default: return false;
    }
  }

  function validateCondition(listPath, ruleIndex, conditionIndex, condition, errors) {
    const at = conditionError(listPath, ruleIndex, conditionIndex);
    if (!condition || typeof condition !== 'object') {
      errors.push(`${at}: not an object`);
      return;
    }
    const field = FIELDS[condition.field];
    if (!field) {
      errors.push(`${at}: unknown field "${condition.field}"`);
      return;
    }
    if (!field.operators.includes(condition.operator)) {
      errors.push(`${at}: field "${condition.field}" has no operator "${condition.operator}"`);
      return;
    }
    const valueKind = OPERATOR_TAKES_NO_VALUE.has(condition.operator) ? 'none' : field.value;
    if (!checkValue(valueKind, condition.value)) {
      const expected = valueKind === 'none' ? 'no value' : `a ${valueKind}`;
      errors.push(`${at}: ${condition.operator} needs ${expected}`);
      return;
    }
    if (condition.operator === 'matches-regex') {
      try {
        new RegExp(condition.value);
      } catch (err) {
        errors.push(`${at}: invalid regex, ${err.message}`);
      }
    }
  }

  function validate(ruleSet) {
    const errors = [];
    if (!ruleSet || typeof ruleSet !== 'object') {
      return { ok: false, errors: ['rule set: not an object'] };
    }
    if (ruleSet.version !== SCHEMA_VERSION) {
      errors.push(`rule set: version must be ${SCHEMA_VERSION}`);
    }
    for (const key of Object.keys(ruleSet)) {
      if (!TOP_LEVEL_KEYS.has(key)) errors.push(`rule set: unknown key "${key}"`);
    }
    for (const [listPath, list] of [['remove', ruleSet.remove], ['protect', ruleSet.protect]]) {
      if (!Array.isArray(list)) {
        errors.push(`rule set: "${listPath}" must be a list`);
        continue;
      }
      list.forEach((rule, ruleIndex) => {
        if (!rule || typeof rule !== 'object' || !Array.isArray(rule.conditions)) {
          errors.push(`${listPath} rule ${ruleIndex + 1}: needs a conditions list`);
          return;
        }
        rule.conditions.forEach((condition, conditionIndex) => {
          validateCondition(listPath, ruleIndex, conditionIndex, condition, errors);
        });
      });
    }
    return { ok: errors.length === 0, errors };
  }

  const api = { SCHEMA_VERSION, FIELDS, validate };

  root.WLCore = Object.assign(root.WLCore || {}, { ruleModel: api });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
