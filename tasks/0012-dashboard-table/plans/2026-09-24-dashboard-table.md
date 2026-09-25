# Plan: dashboard table (issue #12)

## Goal

Build the dashboard table that shows scan results. Wire the scanner through the tab bridge. Support sorting, text filtering, row count, saved scan display, progress during scan, cancel, and error display. No rule builder, preview, or removal logic.

## Decisions

- **jsdom for DOM testing**: The architecture doc already plans jsdom for dashboard tests. Install as devDependency.
- **No chrome.* APIs in dashboard.js**: Since we test with jsdom (no Chrome), the dashboard must accept a bridge abstraction that can be mocked. The real tabBridge wraps chrome.runtime/tabs messaging; the dashboard will use a `createDashboardBridge` factory that defaults to tabBridge but accepts a fake.
- **Storage mock for tests**: storage.js wraps chrome.storage.local. Tests get a memory-backed storage via `createStorage(memoryApi)`.
- **Scanner is called through the bridge**: The bridge's `request('scan', ...)` returns the scan result. This keeps the dashboard decoupled from YouTube I/O.
- **Virtual scrolling for 5k rows**: Use document fragments and batch DOM insertion to keep rendering under 200ms per sort/filter interaction.

## Steps

### Step 1: Add jsdom as devDependency (DONE - already installed)

### Step 2: Write the dashboard HTML structure

Add to `dashboard.html`: scan button, progress area, cancel button, table container, saved scan section.

### Step 3: Write the dashboard CSS

Styles for: scan controls, progress bar, table (sortable columns), filter input, row count, saved scan card, error banner, watched percent bar, thumbnail column.

### Step 4: Implement dashboard.js - core UI logic

- Scan button triggers `bridge.request('scan', { onProgress, signal })`
- Progress updates show page count and item count
- Cancel button aborts the scan signal (previous saved scan stays intact)
- Table renders entries with all columns
- Sort by clicking column headers
- Text filter over title + channelName
- Row count display

### Step 5: Implement dashboard.js - saved scan

- On load, check storage for last scan
- Show age and rescan button if a saved scan exists
- Load saved scan into table without rescanning

### Step 6: Implement dashboard.js - error handling

- Show error banner with type-specific messages (SortNotVerifiedError, SortDriftError, TabGoneError, TimeoutError)

### Step 7: Write jsdom tests

- Test 1: fake bridge serving captured fixtures shows every entry with correct values
- Test 2: reopening dashboard shows saved scan without rescanning
- Test 3: cancel mid scan leaves previous saved scan intact
- Test 4: 5,000 synthetic rows render and sort without freezing >200ms

### Step 8: Run full suite and self-review

`npm run check && npm test && npm run test:browser`, write review, push, open PR.
