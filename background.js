// Store scan results per tab (limited to prevent memory bloat)
const tabResults = new Map();
const MAX_TABS = 20;

function pruneOldResults() {
  if (tabResults.size > MAX_TABS) {
    const oldest = tabResults.keys().next().value;
    tabResults.delete(oldest);
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SCAN_COMPLETE') {
    const tabId = sender.tab.id;

    // Store only essential data
    tabResults.set(tabId, {
      total: message.results.total,
      broken: message.results.broken.slice(0, 100),
      uncertain: message.results.uncertain.slice(0, 100),
      okCount: message.results.okCount
    });
    pruneOldResults();

    // Update badge
    const brokenCount = message.results.broken.length + message.results.uncertain.length;
    if (brokenCount > 0) {
      chrome.action.setBadgeText({ text: brokenCount.toString(), tabId });
      chrome.action.setBadgeBackgroundColor({ color: '#ef4444', tabId });
    } else {
      chrome.action.setBadgeText({ text: '0', tabId });
      chrome.action.setBadgeBackgroundColor({ color: '#22c55e', tabId });
    }
  }

  if (message.type === 'GET_RESULTS') {
    sendResponse(tabResults.get(message.tabId) || null);
  }

  if (message.type === 'START_SCAN') {
    chrome.scripting.executeScript({
      target: { tabId: message.tabId },
      files: ['content.js']
    }).catch(err => console.error('Injection failed:', err));
  }

  if (message.type === 'SCAN_PROGRESS') {
    chrome.runtime.sendMessage(message).catch(() => {});
  }

  return true;
});

chrome.tabs.onRemoved.addListener((tabId) => tabResults.delete(tabId));

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    tabResults.delete(tabId);
    chrome.action.setBadgeText({ text: '', tabId });
  }
});
