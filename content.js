// Inject styles for broken links
const style = document.createElement('style');
style.textContent = `
  .broken-link-checker-broken {
    outline: 2px solid #ef4444 !important;
    outline-offset: 2px;
    background-color: rgba(239, 68, 68, 0.1) !important;
  }
  .broken-link-checker-uncertain {
    outline: 2px solid #f59e0b !important;
    outline-offset: 2px;
    background-color: rgba(245, 158, 11, 0.1) !important;
  }
`;
document.head.appendChild(style);

// Get all unique links on the page
function getAllLinks() {
  const links = document.querySelectorAll('a[href]');
  const seenUrls = new Set();
  const validLinks = [];

  for (const link of links) {
    const href = link.getAttribute('href');

    // Skip non-HTTP links
    if (!href ||
        href.startsWith('javascript:') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        href.startsWith('#') ||
        href.startsWith('data:')) {
      continue;
    }

    // Resolve relative URLs
    let fullUrl;
    try {
      fullUrl = new URL(href, window.location.href).href;
    } catch {
      continue;
    }

    // Only check http/https
    if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
      continue;
    }

    // Skip duplicates but track all elements with this URL
    if (seenUrls.has(fullUrl)) {
      continue;
    }
    seenUrls.add(fullUrl);

    validLinks.push({
      element: link,
      url: fullUrl,
      text: link.textContent.trim().slice(0, 50) || '[No text]'
    });
  }

  return validLinks;
}

// Get all elements for a URL (for highlighting duplicates)
function getElementsForUrl(url) {
  const elements = [];
  document.querySelectorAll('a[href]').forEach(link => {
    try {
      const fullUrl = new URL(link.getAttribute('href'), window.location.href).href;
      if (fullUrl === url) {
        elements.push(link);
      }
    } catch {}
  });
  return elements;
}

// Check if a link is broken
async function checkLink(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-cache',
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (response.type === 'opaque') {
      return { status: 'ok' };
    }
    return response.ok ? { status: 'ok' } : { status: 'broken', code: response.status };
  } catch (error) {
    clearTimeout(timeout);
    if (error.name === 'AbortError') {
      return { status: 'uncertain', error: 'timeout' };
    }

    // Try cors mode as fallback
    try {
      const corsResponse = await fetch(url, {
        method: 'HEAD',
        mode: 'cors',
        cache: 'no-cache'
      });
      return corsResponse.ok ? { status: 'ok' } : { status: 'broken', code: corsResponse.status };
    } catch {
      return { status: 'uncertain', error: 'network' };
    }
  }
}

// Check links in batches
async function checkLinksInBatches(links, batchSize = 5) {
  const results = {
    total: links.length,
    checked: 0,
    broken: [],
    uncertain: [],
    okCount: 0
  };

  for (let i = 0; i < links.length; i += batchSize) {
    const batch = links.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (link) => {
        const result = await checkLink(link.url);
        return { url: link.url, text: link.text, result };
      })
    );

    for (const item of batchResults) {
      results.checked++;

      if (item.result.status === 'broken') {
        results.broken.push({
          url: item.url,
          text: item.text,
          code: item.result.code
        });
        // Highlight all elements with this URL
        getElementsForUrl(item.url).forEach(el =>
          el.classList.add('broken-link-checker-broken')
        );
      } else if (item.result.status === 'uncertain') {
        results.uncertain.push({
          url: item.url,
          text: item.text
        });
        getElementsForUrl(item.url).forEach(el =>
          el.classList.add('broken-link-checker-uncertain')
        );
      } else {
        results.okCount++;
      }
    }

    // Send progress
    chrome.runtime.sendMessage({
      type: 'SCAN_PROGRESS',
      checked: results.checked,
      total: results.total
    }).catch(() => {});
  }

  return results;
}

// Main scan function
async function scanPage() {
  // Remove existing highlights
  document.querySelectorAll('.broken-link-checker-broken, .broken-link-checker-uncertain')
    .forEach(el => el.classList.remove('broken-link-checker-broken', 'broken-link-checker-uncertain'));

  const links = getAllLinks();

  if (links.length === 0) {
    chrome.runtime.sendMessage({
      type: 'SCAN_COMPLETE',
      results: { total: 0, checked: 0, broken: [], uncertain: [], okCount: 0 }
    });
    return;
  }

  chrome.runtime.sendMessage({
    type: 'SCAN_PROGRESS',
    checked: 0,
    total: links.length
  }).catch(() => {});

  const results = await checkLinksInBatches(links);

  chrome.runtime.sendMessage({
    type: 'SCAN_COMPLETE',
    results
  });
}

scanPage();
