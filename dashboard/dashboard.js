'use strict';

(function () {
  var RENDER_CHUNK_SIZE = 100;

  var scanBtn = document.getElementById('scan-btn');
  var cancelBtn = document.getElementById('cancel-btn');
  var progressSection = document.getElementById('progress');
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
  headers.forEach(function (th) {
    th.dataset.label = th.textContent;
  });

  var currentScan = null;
  var filteredEntries = [];
  var sortKey = 'position';
  var sortDir = 1;
  var scanController = null;
  var renderToken = 0;
  var pendingRemoveCount = 0;

  var storage = WLCore.storage.createStorage(chrome.storage.local);
  var bridge = WLCore.tabBridge.createTabBridge(chrome);
  var innertube = {
    browseWatchLater: function (params) { return bridge.request('browseWatchLater', params); },
    browseContinuation: function (token) { return bridge.request('browseContinuation', token); },
    editPlaylist: function (actions) { return bridge.request('editPlaylist', actions); },
  };

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
      case 'AuthError':
        msg = 'Not signed in to YouTube. Sign in and try again.'; break;
      case 'RateLimitedError':
        msg = 'YouTube rate limited the request. Wait and try again.'; break;
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

  function buildRow(entry) {
    var tr = document.createElement('tr');

    var tdPos = document.createElement('td');
    tdPos.textContent = entry.position;
    tr.appendChild(tdPos);

    var tdTitle = document.createElement('td');
    tdTitle.className = 'thumb-cell';
    var thumb = document.createElement('span');
    thumb.className = 'thumb-placeholder';
    tdTitle.appendChild(thumb);
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

    return tr;
  }

  function scheduleChunk(fn) {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(fn);
    else setTimeout(fn, 0);
  }

  function removeChunk(count) {
    var removed = 0;
    while (removed < count && pendingRemoveCount > 0) {
      tableBody.removeChild(tableBody.firstChild);
      pendingRemoveCount -= 1;
      removed += 1;
    }
  }

  function renderChunk(token, start) {
    if (token !== renderToken) return;
    removeChunk(RENDER_CHUNK_SIZE);
    var end = Math.min(start + RENDER_CHUNK_SIZE, filteredEntries.length);
    var fragment = document.createDocumentFragment();
    for (var i = start; i < end; i++) {
      fragment.appendChild(buildRow(filteredEntries[i]));
    }
    tableBody.appendChild(fragment);
    if (end < filteredEntries.length || pendingRemoveCount > 0) {
      scheduleChunk(function () { renderChunk(token, end); });
    }
  }

  function renderTable() {
    renderToken += 1;
    var token = renderToken;
    pendingRemoveCount = tableBody.children.length;
    rowCount.textContent = filteredEntries.length + ' of ' + currentScan.entryCount + ' entries';
    scheduleChunk(function () { renderChunk(token, 0); });
  }

  function clearSavedScan() {
    currentScan = null;
    hide(savedScanSection); hide(tableSection); hide(progressSection);
    hideError(); filterInput.value = ''; scanBtn.disabled = false;
  }

  function showSavedScan(scan) {
    currentScan = scan;
    sortKey = 'position'; sortDir = 1;
    headers.forEach(function (th) {
      th.removeAttribute('data-active-sort');
      th.textContent = th.dataset.label;
    });
    applyFilterAndSort();
    hide(progressSection);
    show(savedScanSection);
    savedInfo.textContent = 'Last scan: ' + formatTimeAgo(scan.scannedAt) + ': ' + scan.entryCount + ' videos scanned in ' + scan.pageCount + ' pages';
    show(tableSection);
  }

  function updateProgress(info) {
    var page = info.page;
    var totalEntries = info.totalEntries;
    var pct = Math.min(95, page * 10);
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

    bridge.ensureTab()
      .then(function () {
        return WLCore.scanner.scan({ innertube: innertube, onProgress: updateProgress, signal: controller.signal });
      })
      .then(function (scan) {
        scanController = null; cancelBtn.hidden = true; scanBtn.disabled = false;
        if (controller.signal.aborted || scan.status !== 'complete') return;
        progressFill.style.width = '100%';
        progressText.textContent = 'Scan complete: ' + scan.entryCount + ' videos';
        return storage.set(WLCore.storage.KEYS.scan, scan).then(function (result) {
          if (!result.ok) {
            errorText.textContent = result.warning;
            show(errorBanner);
          } else {
            hideError();
          }
          showSavedScan(scan);
        });
      })
      .catch(function (err) {
        scanController = null; cancelBtn.hidden = true; scanBtn.disabled = false;
        if (controller.signal.aborted) return;
        hide(progressSection);
        showError(err);
      });
  }

  function cancelScan() {
    if (scanController) { scanController.abort(); scanController = null; cancelBtn.hidden = true; }
    hide(progressSection);
    storage.get(WLCore.storage.KEYS.scan, null).then(function (scan) {
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
      headers.forEach(function (h) {
        h.removeAttribute('data-active-sort');
        h.textContent = h.dataset.label;
      });
      th.setAttribute('data-active-sort', sortDir === 1 ? 'asc' : 'desc');
      th.textContent = th.dataset.label + (sortDir === 1 ? ' \u25B2' : ' \u25BC');
      applyFilterAndSort();
    });
  });

  var statusEl = document.getElementById('status');
  if (statusEl && WLCore.constants && WLCore.constants.VERSION_TAG) {
    statusEl.dataset.version = WLCore.constants.VERSION_TAG;
  }

  storage.get(WLCore.storage.KEYS.scan, null).then(function (scan) {
    if (scan && scan.entries && scan.entries.length > 0) showSavedScan(scan);
    else { hide(savedScanSection); hide(tableSection); hide(progressSection); hideError(); }
  });
})();
