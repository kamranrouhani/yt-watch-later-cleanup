'use strict';

(function (root) {
  const PLAN_KIND = 'removal-plan';
  const PLAN_VERSION = 1;
  const DEFAULT_BATCH_SIZE = 25;
  const DEFAULT_PAUSE_MS = 1500;
  const MIN_BATCH_SIZE = 1;
  const MAX_BATCH_SIZE = 50;
  const MIN_PAUSE_MS = 0;
  const MAX_PAUSE_MS = 60000;

  function deepFreeze(value) {
    if (value && typeof value === 'object') {
      for (const child of Object.values(value)) deepFreeze(child);
      return Object.freeze(value);
    }
    return value;
  }

  function createPlan(previewResult, fingerprint) {
    if (!previewResult || typeof previewResult !== 'object' || !Array.isArray(previewResult.remove)) {
      throw new TypeError('createPlan: previewResult.remove is required');
    }
    if (previewResult.remove.length === 0) {
      throw new TypeError('createPlan: the preview remove list is empty, nothing to remove');
    }
    for (const { entry } of previewResult.remove) {
      if (!entry || typeof entry.setVideoId !== 'string' || !entry.setVideoId) {
        throw new TypeError('createPlan: every previewed entry needs a setVideoId');
      }
    }
    return deepFreeze({
      kind: PLAN_KIND,
      version: PLAN_VERSION,
      setVideoIds: previewResult.remove.map(({ entry }) => entry.setVideoId),
      entries: previewResult.remove.map(({ entry }) => ({ ...entry })),
      fingerprint: deepFreeze({ ...(fingerprint || {}) }),
    });
  }

  function isApprovedPlan(plan) {
    if (!plan || typeof plan !== 'object') return false;
    if (plan.kind !== PLAN_KIND || plan.version !== PLAN_VERSION) return false;
    if (!Object.isFrozen(plan) || !Object.isFrozen(plan.setVideoIds) || !Object.isFrozen(plan.entries)) return false;
    if (!Array.isArray(plan.setVideoIds) || plan.setVideoIds.length === 0) return false;
    return plan.setVideoIds.every((id) => typeof id === 'string' && id);
  }

  function defaultSleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function run(approvedPlan, options = {}) {
    if (!isApprovedPlan(approvedPlan)) {
      throw new TypeError('run: expects a frozen plan from createPlan');
    }
    const {
      innertube,
      batchSize = DEFAULT_BATCH_SIZE,
      pauseMs = DEFAULT_PAUSE_MS,
      signal,
      onBatch,
      sleep = defaultSleep,
    } = options;
    if (!innertube || typeof innertube.editPlaylist !== 'function') {
      throw new TypeError('run: options.innertube is required');
    }
    if (!Number.isInteger(batchSize) || batchSize < MIN_BATCH_SIZE || batchSize > MAX_BATCH_SIZE) {
      throw new RangeError(`run: batchSize must be an integer from ${MIN_BATCH_SIZE} to ${MAX_BATCH_SIZE}`);
    }
    if (!Number.isInteger(pauseMs) || pauseMs < MIN_PAUSE_MS || pauseMs > MAX_PAUSE_MS) {
      throw new RangeError(`run: pauseMs must be an integer from ${MIN_PAUSE_MS} to ${MAX_PAUSE_MS}`);
    }

    const batches = [];
    const removedSetVideoIds = [];

    for (let index = 1; ; index += 1) {
      if (signal && signal.aborted) {
        return { status: 'stopped', removedSetVideoIds, batches, stopReason: 'aborted before batch ' + index };
      }
      const start = (index - 1) * batchSize;
      if (start >= approvedPlan.setVideoIds.length) break;
      const ids = approvedPlan.setVideoIds.slice(start, start + batchSize);
      const entries = approvedPlan.entries.slice(start, start + batchSize);

      let actions;
      try {
        actions = ids.map((setVideoId) => ({ action: 'ACTION_REMOVE_VIDEO', setVideoId }));
        await innertube.editPlaylist(actions);
      } catch (err) {
        return { status: 'stopped', removedSetVideoIds, batches, stopReason: `stopped on batch ${index}: ${err.message}` };
      }

      removedSetVideoIds.push(...ids);
      batches.push({ index, entries, ok: true });
      if (onBatch) onBatch({ index, entries });

      if (start + batchSize < approvedPlan.setVideoIds.length) {
        if (signal && signal.aborted) {
          return { status: 'stopped', removedSetVideoIds, batches, stopReason: 'aborted after batch ' + index };
        }
        await sleep(pauseMs);
      }
    }

    return { status: 'complete', removedSetVideoIds, batches, stopReason: null };
  }

  const api = { createPlan, run, DEFAULT_BATCH_SIZE, DEFAULT_PAUSE_MS };

  root.WLCore = Object.assign(root.WLCore || {}, { remover: api });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
