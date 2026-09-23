'use strict';

(function () {
  if (window.__wlBridgeInstalled) return;
  window.__wlBridgeInstalled = true;

  const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.wlBridge !== true || data.type !== 'response' || typeof data.id !== 'number') return;
    const reply = { wlResponse: true, id: data.id, ok: data.ok };
    if (data.ok) reply.result = data.result;
    else reply.error = data.error;
    chrome.runtime.sendMessage(reply);
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg || msg.wlRequest !== true) return false;
    window.postMessage({
      wlBridge: true,
      nonce,
      type: 'request',
      kind: msg.kind,
      id: msg.id,
      payload: msg.payload,
    }, window.location.origin);
    return false;
  });

  window.postMessage({ wlBridge: true, type: 'hello', nonce }, window.location.origin);
})();
