'use strict';

function createFakeStorage({ quotaBytes = Infinity } = {}) {
  const backing = new Map();

  function sizeOf(value) {
    return JSON.stringify(value).length;
  }

  const area = {
    async get(keys) {
      const wanted = Array.isArray(keys) ? keys : [keys];
      const out = {};
      for (const key of wanted) {
        if (backing.has(key)) out[key] = backing.get(key);
      }
      return out;
    },
    async set(items) {
      for (const [key, value] of Object.entries(items)) {
        const others = [...backing.entries()]
          .filter(([k]) => k !== key)
          .reduce((sum, [, v]) => sum + sizeOf(v), 0);
        if (others + sizeOf(value) > quotaBytes) {
          const err = new Error(`QUOTA_BYTES_PER_ITEM exceeded for ${key}`);
          err.name = 'QuotaExceededError';
          throw err;
        }
        backing.set(key, value);
      }
    },
    async remove(keys) {
      for (const key of Array.isArray(keys) ? keys : [keys]) backing.delete(key);
    },
  };

  return { area, backing };
}

module.exports = { createFakeStorage };
