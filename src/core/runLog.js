'use strict';

(function (root) {
  const { createStorage, KEYS } = root.WLCore && root.WLCore.storage
    ? root.WLCore.storage
    : require('./storage.js');

  function serialise(run) {
    const { writeWarning, ...publicRun } = run;
    return publicRun;
  }

  function createRunLog(storage) {
    async function readLogs() {
      return storage.get(KEYS.runLogs, []);
    }

    async function writeLogs(logs) {
      return storage.set(KEYS.runLogs, logs);
    }

    async function start(meta = {}) {
      const logs = await readLogs();
      const run = {
        id: `run-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
        startedAt: new Date().toISOString(),
        finishedAt: null,
        abortedAt: null,
        status: 'running',
        abortedReason: null,
        meta,
        batches: [],
      };
      const writeResult = await writeLogs([run, ...logs]);
      run.writeWarning = writeResult.ok ? null : writeResult.warning;

      return {
        async appendBatch(entries, matchedRule) {
          run.batches.push({
            at: new Date().toISOString(),
            entries: entries.map((entry) => ({ ...entry })),
            matchedRule,
          });
          const current = await readLogs();
          const persisted = { ...(current.find((l) => l.id === run.id) || {}), ...serialise(run) };
          const next = current.some((l) => l.id === run.id)
            ? current.map((l) => (l.id === run.id ? persisted : l))
            : [persisted, ...current];
          const result = await writeLogs(next);
          run.writeWarning = result.ok ? null : result.warning;
          return result;
        },
        async finish() {
          run.status = 'finished';
          run.finishedAt = new Date().toISOString();
          return persistStatus(run);
        },
        async abort(reason) {
          run.status = 'aborted';
          run.abortedAt = new Date().toISOString();
          run.abortedReason = reason;
          return persistStatus(run);
        },
        toJSON: () => serialise(run),
      };
    }

    async function persistStatus(run) {
      const serialised = serialise(run);
      const current = await readLogs();
      const persisted = current.find((l) => l.id === run.id);
      const updated = current.map((l) => (l.id === run.id ? serialised : l));
      const result = await writeLogs(persisted ? updated : [serialised, ...current]);
      run.writeWarning = result.ok ? null : result.warning;
      return result;
    }

    return { start, list: readLogs };
  }

  function exportJSON(logs) {
    return {
      exportedAt: new Date().toISOString(),
      runs: (logs || []).map((run) => ({
        id: run.id,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        abortedAt: run.abortedAt,
        status: run.status,
        abortedReason: run.abortedReason,
        meta: run.meta,
        removed: (run.batches || []).flatMap((batch) => batch.entries.map((entry) => ({
          videoId: entry.videoId,
          title: entry.title,
          channelName: entry.channelName,
          channelId: entry.channelId,
          matchedRule: batch.matchedRule,
        }))),
      })),
    };
  }

  const api = { createRunLog, exportJSON };

  root.WLCore = Object.assign(root.WLCore || {}, { runLog: api });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
