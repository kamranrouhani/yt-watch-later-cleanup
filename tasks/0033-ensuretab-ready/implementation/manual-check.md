# Manual check: #33 ensureTab waits for the tab to answer

Run this in your own signed-in Chrome, on the merged `main`. This repeats
step 5 of `tasks/0011-tab-bridge/implementation/manual-check.md`, which is
exactly the check that first surfaced this bug: before this fix,
`ensureTab()` opened a new tab and returned immediately, and the ping
against it failed with `TabGoneError` because the content scripts had not
attached yet.

1. Open `chrome://extensions`, reload the extension, and open the
   dashboard from the toolbar. Make sure no `https://www.youtube.com/playlist?list=WL`
   tab is open anywhere.

2. In the dashboard DevTools console, run:
   ```js
   const b = WLCore.tabBridge.createTabBridge(chrome);
   await b.ensureTab();
   await b.request('ping', null);
   ```
   Expect: `ensureTab()` opens a new background Watch Later tab, the
   `await` on it does not resolve until that tab has actually finished
   loading (watch the tab's spinner in the tab strip; the console command
   should pause visibly rather than return instantly), and the ping then
   returns an object like
   `{ clientVersion: "2.2026xxxx.xx.xx", signedIn: true }` matching the
   real page.

3. Repeat step 2 once more with the Watch Later tab already open (do not
   close it this time). Expect: `ensureTab()` reuses the existing tab (no
   second tab opens) and the ping still succeeds, this time close to
   instantly since the tab is already loaded.

4. Open `https://www.youtube.com/playlist?list=WL&index=3` by hand (a real
   URL with extra query parameters, as YouTube itself sometimes appends).
   Run step 2's `ensureTab()` again. Expect: the existing tab with the
   extra parameters is reused, no second tab opens.
