# Manual check: #1 scaffold

Things headless Chrome on the build host cannot do. Run these in your own
Chrome, on the merged `main` or the PR branch.

1. Open `chrome://extensions`, turn on developer mode, click "Load unpacked"
   and select the repository root.
   Expect: a "Watch Later Cleanup" card, version 0.1.0, switched on, and no
   red "Errors" button on the card.
2. Pin the extension from the puzzle piece menu and click its toolbar icon.
   Expect: a new tab opens titled "Watch Later Cleanup", showing the heading
   and "Not connected to YouTube yet."
3. Switch to another tab and click the toolbar icon again.
   Expect: the existing dashboard tab comes to the front. No second
   dashboard tab opens.
4. Close the dashboard tab and click the icon once more.
   Expect: a fresh dashboard tab opens.
5. Open the card's "Details" page.
   Expect: site access lists only `https://www.youtube.com/*`, and the only
   permission line is "Read your browsing history" (that is how Chrome
   words `tabs`).

Already covered on the build host by `npm run test:browser`: the extension
loads with no manifest or runtime errors, the click listener is registered,
the dashboard renders, and calling the click handler twice leaves one
dashboard tab.

Note: if you ran `npm install`, the loaded folder includes `node_modules/`
(about 18 MB of Playwright). It does not stop the extension loading, but the
details page will show that size.
