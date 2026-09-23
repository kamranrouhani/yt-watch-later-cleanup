# Manual check: #11 tab bridge

Run these in your own Chrome, on the merged `main`. The build host cannot
sign in to YouTube, so the real `ytcfg` and cookies only exist for you.

1. Open `chrome://extensions`, reload the extension, and open the dashboard
   from the toolbar.
   Expect: no new errors on the extension card. The card's "service worker"
   and "Inspect views" stay error free.

2. Open `https://www.youtube.com/playlist?list=WL` signed in, in another
   tab. Open DevTools on that tab, Console, and run:
   `window.__wlPage === true && window.__wlReady === true`
   Expect: `true`. That proves both content scripts injected and the nonce
   handshake happened.

3. In the dashboard DevTools console, run:
   `WLCore.tabBridge.createTabBridge(chrome).request('ping', null)`
   after `ensureTab()`:
   ```js
   const b = WLCore.tabBridge.createTabBridge(chrome);
   await b.ensureTab();
   await b.request('ping', null);
   ```
   Expect: an object like
   `{ clientVersion: "2.2026xxxx.xx.xx", signedIn: true }` where the version
   matches the real YouTube page. This is the issue's debug ping.

4. Close the Watch Later tab while that ping is in flight (hard to time by
   hand; skip if awkward, the automated test covers it).
   Expect: the promise rejects with `TabGoneError`, it does not hang.

5. With the Watch Later tab closed, run steps 2 and 3 again.
   Expect: `ensureTab()` opens a new background Watch Later tab by itself,
   then the ping works.
