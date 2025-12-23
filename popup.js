// DOM elements
const idleState = document.getElementById('idle-state');
const scanningState = document.getElementById('scanning-state');
const resultsState = document.getElementById('results-state');
const scanBtn = document.getElementById('scan-btn');
const rescanBtn = document.getElementById('rescan-btn');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');
const totalLinks = document.getElementById('total-links');
const brokenCount = document.getElementById('broken-count');
const uncertainCount = document.getElementById('uncertain-count');
const brokenList = document.getElementById('broken-list');
const uncertainList = document.getElementById('uncertain-list');
const brokenLinks = document.getElementById('broken-links');
const uncertainLinks = document.getElementById('uncertain-links');

// Show a specific state
function showState(state) {
  idleState.classList.add('hidden');
  scanningState.classList.add('hidden');
  resultsState.classList.add('hidden');
  state.classList.remove('hidden');
}

// Start scanning
async function startScan() {
  showState(scanningState);
  progressFill.style.width = '0%';
  progressText.textContent = 'Starting scan...';

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.runtime.sendMessage({
    type: 'START_SCAN',
    tabId: tab.id
  });
}

// Display results
function displayResults(results) {
  showState(resultsState);

  totalLinks.textContent = results.total;
  brokenCount.textContent = results.broken.length;
  uncertainCount.textContent = results.uncertain.length;

  // Clear previous lists
  brokenLinks.innerHTML = '';
  uncertainLinks.innerHTML = '';

  // Show broken links
  if (results.broken.length > 0) {
    brokenList.classList.remove('hidden');
    results.broken.forEach(link => {
      const li = document.createElement('li');
      li.innerHTML = `
        <span class="link-text">${escapeHtml(link.text)}</span>
        <a href="${escapeHtml(link.url)}" target="_blank" class="link-url">${escapeHtml(truncateUrl(link.url))}</a>
        ${link.code ? `<span class="status-code">${link.code}</span>` : ''}
      `;
      brokenLinks.appendChild(li);
    });
  } else {
    brokenList.classList.add('hidden');
  }

  // Show uncertain links
  if (results.uncertain.length > 0) {
    uncertainList.classList.remove('hidden');
    results.uncertain.forEach(link => {
      const li = document.createElement('li');
      li.innerHTML = `
        <span class="link-text">${escapeHtml(link.text)}</span>
        <a href="${escapeHtml(link.url)}" target="_blank" class="link-url">${escapeHtml(truncateUrl(link.url))}</a>
      `;
      uncertainLinks.appendChild(li);
    });
  } else {
    uncertainList.classList.add('hidden');
  }
}

// Helper: escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Helper: truncate long URLs
function truncateUrl(url) {
  return url.length > 50 ? url.slice(0, 47) + '...' : url;
}

// Listen for progress updates
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'SCAN_PROGRESS') {
    const percent = Math.round((message.checked / message.total) * 100);
    progressFill.style.width = `${percent}%`;
    progressText.textContent = `Checking ${message.checked} of ${message.total} links...`;
  }

  if (message.type === 'SCAN_COMPLETE') {
    displayResults(message.results);
  }
});

// Check for existing results when popup opens
async function checkExistingResults() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.runtime.sendMessage(
    { type: 'GET_RESULTS', tabId: tab.id },
    (results) => {
      if (results) {
        displayResults(results);
      }
    }
  );
}

// Event listeners
scanBtn.addEventListener('click', startScan);
rescanBtn.addEventListener('click', startScan);

// Initialize
checkExistingResults();
