'use strict';

(function () {
  var STORAGE_KEY = 'scan:v1';
  var MAX_ROWS_RENDERED = 5000;

  // DOM refs
  var scanBtn = document.getElementById('scan-btn');
  var cancelBtn = document.getElementById('cancel-btn');
  var progressSection = document.getElementById('progress');
  var progressBar = document.getElementById('progress-bar');
  var progressFill = document.getElementById('progress-fill');
  var progressText = document.getElementById('progress-text');
  var savedScanSection = document.getElementById('saved-scan');
  var savedInfo = document.getElementById('saved-info');
  var rescanBtn = document.getElementById('rescan-btn');
  var errorBanner = document.getElementById('error-banner');
  var errorText = document.getElementById('error-text');
  var tableSection = document.getElementById('table-section');
  var filterInput = document.getElementById('filter-input');
  var rowCount = document.getElementById('row-count');
  var tableBody = document.getElementById('table-body');
  var headers = tableSection.querySelectorAll('th.sortable');

  // State
  var currentScan = null;
  var filteredEntries = [];
  var sortKey = 'position';
  var sortDir = 1;
  var scanController = null;

  function createStorage(area) {
    var useChrome = !!area;
    if (!useChrome) {
      area = {
        get: function (keys) { return Promise.resolve({}); },
        set: function () { return Promise.resolve(); },
      };
    }
    var version = 1;
    return {
      read: function (key) {
        return area.get([key]).then(function (found) {
          var raw = found && found[key];
          if (!raw || typeof raw !== 'object' || raw.v !== version) return null;
          return raw.data;
        });
      },
      write: function (key, value) {
        return area.set({ [key]: { v: version, data: value } }).then(function () {
          return { ok: true };
        });
      },
    };
  }

  var storage = createStorage(chrome && chrome.storage ? chrome.storage.local : null);

  function show(el) { el.hidden = false; }
  function hide(el) { el.hidden = true; }

  function formatDuration(seconds) {
    if (seconds == null || !Number.isFinite(seconds)) return '';
    var h = Math.floor(seconds / 3600);
    var m = Math.floor((seconds % 3600) / 60);
    var s = seconds % 60;
    if (h > 0) return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    return m + ':' + String(s).padStart(2, '0');
  }

  function formatTimeAgo(isoString) {
    var diff = Date.now() - new Date(isoString).getTime();
    var mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + 'm ago';
    var hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + 'h ago';
    return Math.floor(hrs / 24) + 'd ago';
  }

  function showError(error) {
    var msg;
    switch (error.name) {
      case 'SortNotVerifiedError':
        msg = 'Could not verify playlist sort. Stop playlist changes on all devices and retry.'; break;
      case 'SortDriftError':
        msg = 'Playlist sort changed during scan. Refresh and try again.'; break;
      case 'TabGoneError':
        msg = 'The YouTube tab closed mid-scan. Open the Watch Later page and try again.'; break;
      case 'TimeoutError':
        msg = 'The request timed out. Check your connection and retry.'; break;
      default:
        msg = error.message || String(error);
    }
    errorText.textContent = msg;
    show(errorBanner);
  }

  function hideError() { hide(errorBanner); }

  function sortEntries(entries) {
    return entries.slice().sort(function (a, b) {
      var va = a[sortKey], vb = b[sortKey];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === 'string') return sortDir * va.localeCompare(vb);
      return sortDir * (va - vb);
    });
  }

  function filterEntries(entries) {
    var q = filterInput.value.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(function (e) {
      return (e.title || '').toLowerCase().indexOf(q) !== -1
        || (e.channelName || '').toLowerCase().indexOf(q) !== -1;
    });
  }

  function applyFilterAndSort() {
    filteredEntries = filterEntries(sortEntries(currentScan.entries));
    renderTable();
  }

  function formatWatchedBar(pct) {
    return '<span class="watched-bar"><span class="watched-bar-fill" style="width:' + pct + '%"></span></span>' + pct + '%';
  }

  function renderTable() {
    var fragment = document.createDocumentFragment();
    var count = Math.min(filteredEntries.length, MAX_ROWS_RENDERED);
    for (var i = 0; i < count; i++) {
      var entry = filteredEntries[i];
      var tr = document.createElement('tr');

      var tdPos = document.createElement('td');
      tdPos.textContent = entry.position;
      tr.appendChild(tdPos);

      var tdTitle = document.createElement('td');
      tdTitle.className = 'thumb-cell';
      if (entry.thumbnails && entry.thumbnails.length > 0) {
        var img = document.createElement('img');
        img.src = entry.thumbnails[0].url;
        img.alt = '';
        img.loading = 'lazy';
        tdTitle.appendChild(img);
      }
      var a = document.createElement('a');
      a.href = 'https://www.youtube.com/watch?v=' + (entry.videoId || '');
      a.target = '_blank';
      a.className = 'title-link';
      a.textContent = entry.title || '';
      tdTitle.appendChild(a);
      if (entry.isShort) {
        var badge = document.createElement('span');
        badge.className = 'short-badge';
        badge.textContent = 'SHORT';
        tdTitle.appendChild(badge);
      }
      if (entry.isLive) {
        var liveBadge = document.createElement('span');
        liveBadge.className = 'live-badge';
        liveBadge.textContent = 'LIVE';
        tdTitle.appendChild(liveBadge);
      }
      tr.appendChild(tdTitle);

      var tdChannel = document.createElement('td');
      tdChannel.textContent = entry.channelName || '';
      tr.appendChild(tdChannel);

      var tdDuration = document.createElement('td');
      tdDuration.textContent = formatDuration(entry.durationSeconds);
      tr.appendChild(tdDuration);

      var tdWatched = document.createElement('td');
      tdWatched.innerHTML = formatWatchedBar(entry.watchedPercent);
      tr.appendChild(tdWatched);

      var tdPublished = document.createElement('td');
      tdPublished.textContent = entry.publishedText || '';
      tr.appendChild(tdPublished);

      var tdStatus = document.createElement('td');
      if (!entry.playable) {
        tdStatus.className = 'unplayable';
        tdStatus.textContent = entry.unavailableReason || 'Unavailable';
      } else {
        tdStatus.textContent = 'Playable';
      }
      tr.appendChild(tdStatus);

      fragment.appendChild(tr);
    }
    tableBody.innerHTML = '';
    tableBody.appendChild(fragment);
    rowCount.textContent = filteredEntries.length + ' of ' + currentScan.entryCount + ' entries';
  }

  function clearSavedScan() {
    currentScan = null;
    hide(savedScanSection); hide(tableSection); hide(progressSection);
    hideError(); filterInput.value = ''; scanBtn.disabled = false;
  }

  function showSavedScan(scan) {
    currentScan = scan;
    sortKey = 'position'; sortDir = 1;
    headers.forEach(function (th) { th.removeAttribute('data-active-sort'); });
    applyFilterAndSort();
    hide(progressSection); hideError();
    show(savedScanSection);
    savedInfo.textContent = 'Last scan: ' + formatTimeAgo(scan.scannedAt) + ' — ' + scan.entryCount + ' videos scanned in ' + scan.pageCount + ' pages';
    show(tableSection);
  }

  function updateProgress(page, pageEntries, totalEntries) {
    var pct = Math.round((page / 3) * 100);
    if (totalEntries > 0) pct = Math.min(95, Math.round((totalEntries / MAX_ROWS_RENDERED) * 100));
    progressFill.style.width = pct + '%';
    progressText.textContent = 'Page ' + page + ', ' + totalEntries + ' items found';
  }

  function startScan() {
    clearSavedScan();
    scanBtn.disabled = true;
    show(progressSection); hide(savedScanSection);
    var controller = new AbortController();
    scanController = controller;
    cancelBtn.hidden = false;
    chrome.runtime.sendMessage(
      { wlRequest: true, kind: 'scan', id: 0, payload: { onProgress: updateProgress, signal: controller.signal } },
      function (response) {
        scanController = null; cancelBtn.hidden = true; scanBtn.disabled = false;
        if (!response || !response.ok) {
          hide(progressSection);
          showError(new Error(response && response.error ? response.error.message : 'Scan failed'));
          return;
        }
        var scan = response.result;
        currentScan = scan;
        progressFill.style.width = '100%';
        progressText.textContent = 'Scan complete: ' + scan.entryCount + ' videos';
        storage.write(STORAGE_KEY, scan).then(function () { showSavedScan(scan); });
      }
    );
  }

  function cancelScan() {
    if (scanController) { scanController.abort(); scanController = null; cancelBtn.hidden = true; }
    hide(progressSection);
    // Restore saved scan if one exists
    storage.read(STORAGE_KEY).then(function (scan) {
      if (scan && scan.entries && scan.entries.length > 0) showSavedScan(scan);
    });
  }

  scanBtn.addEventListener('click', startScan);
  cancelBtn.addEventListener('click', cancelScan);
  rescanBtn.addEventListener('click', startScan);
  filterInput.addEventListener('input', applyFilterAndSort);

  headers.forEach(function (th) {
    th.addEventListener('click', function () {
      var key = th.getAttribute('data-sort');
      if (sortKey === key) sortDir *= -1;
      else { sortKey = key; sortDir = 1; }
      headers.forEach(function (h) { h.removeAttribute('data-active-sort'); });
      th.setAttribute('data-active-sort', 'asc');
      if (sortDir === -1) th.textContent = th.textContent.replace(/s*$/, ' ▲');
      else th.textContent = th.textContent.replace(/s*$/, ' ▼');
      applyFilterAndSort();
    });
  });

  var statusEl = document.getElementById('status');
  if (statusEl && WLCore.constants && WLCore.constants.VERSION_TAG) {
    statusEl.dataset.version = WLCore.constants.VERSION_TAG;
  }

  storage.read(STORAGE_KEY).then(function (scan) {
    if (scan && scan.entries && scan.entries.length > 0) showSavedScan(scan);
    else { hide(savedScanSection); hide(tableSection); hide(progressSection); hideError(); }
  });
})();
