'use strict';

const DASHBOARD_PATH = 'dashboard/dashboard.html';

async function openDashboard() {
  const url = chrome.runtime.getURL(DASHBOARD_PATH);
  const [existing] = await chrome.tabs.query({ url });
  if (existing) {
    await chrome.tabs.update(existing.id, { active: true });
    await chrome.windows.update(existing.windowId, { focused: true });
    return;
  }
  await chrome.tabs.create({ url });
}

chrome.action.onClicked.addListener(openDashboard);
