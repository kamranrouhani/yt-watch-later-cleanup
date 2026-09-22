'use strict';

(function (root) {
  const constants = Object.freeze({
    VERSION_TAG: 'wl-cleanup',
    WATCH_LATER_PLAYLIST_ID: 'WL',
    WATCH_LATER_URL: 'https://www.youtube.com/playlist?list=WL',
    YOUTUBE_ORIGIN: 'https://www.youtube.com',
    DATA_API_ORIGIN: 'https://www.googleapis.com',
  });

  const api = { constants };

  root.WLCore = Object.assign(root.WLCore || {}, api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
