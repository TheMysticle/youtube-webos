// Tizen standalone loader script for YouTube TV

declare global {
  interface Window {
    tizen?: any;
    tizenLoaderExecuted?: boolean;
    tizenInitialURL?: string;
    ytaf_showOptionsPanel?: (visible?: boolean) => void;
  }
}

export async function runTizenLoader() {
  console.info('[TizenLoader] Starting loader...');

  // 1. Setup global flags
  window.tizenLoaderExecuted = false;

  // 2. Monkey-patch fetch to intercept relative requests
  const originalFetch = window.fetch;
  window.fetch = function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    let urlStr = '';
    if (typeof input === 'string') {
      urlStr = input;
    } else if (input instanceof URL) {
      urlStr = input.toString();
    } else if (input && typeof input === 'object' && 'url' in input) {
      urlStr = (input as any).url;
    }

    if (
      urlStr &&
      !urlStr.startsWith('http://') &&
      !urlStr.startsWith('https://') &&
      !urlStr.startsWith('file://') &&
      !urlStr.startsWith('data:')
    ) {
      const newUrl = new URL(urlStr, 'https://www.youtube.com');
      console.debug('[TizenLoader] fetch redirect:', urlStr, '->', newUrl.toString());
      if (typeof input === 'string') {
        input = newUrl.toString();
      } else if (input instanceof URL) {
        input = newUrl;
      } else if (input && typeof input === 'object' && 'url' in input) {
        input = new Request(newUrl.toString(), input as any);
      }
    }
    return originalFetch.call(this, input, init);
  };

  // 3. Monkey-patch XMLHttpRequest.open to intercept relative requests
  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (
    this: XMLHttpRequest,
    method: string,
    url: string | URL,
    async?: boolean,
    user?: string | null,
    password?: string | null
  ) {
    let urlStr = typeof url === 'string' ? url : url.toString();
    if (
      urlStr &&
      !urlStr.startsWith('http://') &&
      !urlStr.startsWith('https://') &&
      !urlStr.startsWith('file://') &&
      !urlStr.startsWith('data:')
    ) {
      const newUrl = new URL(urlStr, 'https://www.youtube.com');
      url = newUrl.toString();
    }
    return originalOpen.call(this, method, url, async ?? true, user, password);
  } as any;

  // 4. Monkey-patch Document.prototype.createElement to intercept relative script/image/video URLs
  const originalCreateElement = Document.prototype.createElement;
  Document.prototype.createElement = function (this: Document, tagName: string, options?: ElementCreationOptions): HTMLElement {
    const element = originalCreateElement.call(this, tagName, options);
    const tag = tagName.toLowerCase();

    if (
      tag === 'script' ||
      tag === 'link' ||
      tag === 'img' ||
      tag === 'video' ||
      tag === 'audio' ||
      tag === 'source'
    ) {
      const resolveUrl = (val: any) => {
        if (
          typeof val === 'string' &&
          val &&
          !val.startsWith('http://') &&
          !val.startsWith('https://') &&
          !val.startsWith('file://') &&
          !val.startsWith('data:')
        ) {
          // If it references our local userScript or index, don't redirect it
          if (val.includes('userScript.js') || val.includes('index.js')) {
            return val;
          }
          return new URL(val, 'https://www.youtube.com').toString();
        }
        return val;
      };

      const originalSetAttribute = element.setAttribute;
      element.setAttribute = function (name: string, value: string) {
        const attr = name.toLowerCase();
        if (attr === 'src' || attr === 'href') {
          value = resolveUrl(value);
        }
        return originalSetAttribute.call(this, name, value);
      };

      if (tag === 'script' || tag === 'img' || tag === 'video' || tag === 'audio' || tag === 'source') {
        Object.defineProperty(element, 'src', {
          get() {
            return element.getAttribute('src') || '';
          },
          set(value) {
            element.setAttribute('src', value);
          },
          configurable: true,
        });
      }
      if (tag === 'link') {
        Object.defineProperty(element, 'href', {
          get() {
            return element.getAttribute('href') || '';
          },
          set(value) {
            element.setAttribute('href', value);
          },
          configurable: true,
        });
      }
    }
    return element;
  } as any;

  // 5. Tizen Remote Key Registration
  if (window.tizen && window.tizen.tvinputdevice) {
    const tizenKeys = [
      'ColorF0Red',
      'ColorF1Green',
      'ColorF2Yellow',
      'ColorF3Blue',
      'MediaPlay',
      'MediaPause',
      'MediaPlayPause',
      'MediaStop',
      'MediaFastForward',
      'MediaRewind',
    ];
    tizenKeys.forEach((keyName) => {
      try {
        window.tizen.tvinputdevice.registerKey(keyName);
        console.debug('[TizenLoader] Registered key:', keyName);
      } catch (e) {
        console.warn('[TizenLoader] Failed to register key:', keyName, e);
      }
    });
  }

  // 6. Return / Back Key Mapping for remote control
  window.addEventListener('keydown', (evt: KeyboardEvent) => {
    if (evt.keyCode === 10009) {
      console.debug('[TizenLoader] Return/Back key intercepted.');

      // Check if options panel from UI is open
      const optionsContainer = document.querySelector('#ytaf-options-overlay, .ytaf-ui-container') as HTMLElement;
      if (optionsContainer && optionsContainer.style.display !== 'none') {
        if (window.ytaf_showOptionsPanel) {
          window.ytaf_showOptionsPanel(false);
          evt.preventDefault();
          evt.stopPropagation();
          return;
        }
      }

      // Dispatch Escape key down to active element so YouTube TV UI handles it
      const escapeEvt = new KeyboardEvent('keydown', {
        key: 'Escape',
        code: 'Escape',
        keyCode: 27,
        which: 27,
        bubbles: true,
        cancelable: true,
      });
      const target = document.activeElement || document.body;
      target.dispatchEvent(escapeEvt);

      evt.preventDefault();
      evt.stopPropagation();
    }
  });

  // 7. Load and Inject YouTube Leanback
  await fetchAndRewriteYoutube();
}

async function fetchAndRewriteYoutube() {
  const targetUrlStr = window.tizenInitialURL || 'https://www.youtube.com/tv#/';
  const targetUrl = new URL(targetUrlStr);
  
  // We fetch without hash since hash is client-side only
  const fetchUrl = new URL(targetUrl.pathname + targetUrl.search, 'https://www.youtube.com');

  try {
    console.info('[TizenLoader] Fetching YouTube from:', fetchUrl.toString());
    const response = await fetch(fetchUrl.toString(), { cache: 'no-store' });
    if (!response.ok) throw new Error('Status: ' + response.status);

    let html = await response.text();
    console.info('[TizenLoader] Fetched HTML size:', html.length);

    // Get current local path directory
    const localAppPath = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);
    const userScriptTag = `<script src="${localAppPath}webOSUserScripts/userScript.js"></script>`;
    const baseTag = '<base href="https://www.youtube.com/">';

    // Inject base href and our userScript at the very beginning of <head>
    html = html.replace('<head>', `<head>${baseTag}${userScriptTag}`);

    // Set location hash to what we parsed from initial URL (if any)
    if (targetUrl.hash) {
      console.info('[TizenLoader] Setting initial hash:', targetUrl.hash);
      window.location.hash = targetUrl.hash;
    }

    // Set loader executed flag
    window.tizenLoaderExecuted = true;

    // Rewrite document
    document.open();
    document.write(html);
    document.close();
  } catch (error) {
    console.error('[TizenLoader] Fetch failed:', error);
    showNetworkErrorUI();
  }
}

function showNetworkErrorUI() {
  // Clear body and insert error overlay
  document.body.innerHTML = `
    <div id="tizen-network-error" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background-color: #0f0f0f; color: #fff; font-family: system-ui, -apple-system, sans-serif; display: flex; flex-direction: column; justify-content: center; align-items: center; z-index: 99999; box-sizing: border-box; padding: 2rem;">
      <div style="font-size: 5rem; color: #ff0000; margin-bottom: 1.5rem; animation: pulse 2s infinite ease-in-out;">⚠️</div>
      <h1 style="font-size: 2.2rem; margin-bottom: 0.5rem; font-weight: 600; text-align: center;">Network Connection Error</h1>
      <p style="font-size: 1.1rem; color: #aaa; margin-bottom: 2.5rem; text-align: center; max-width: 500px; line-height: 1.5;">Unable to load YouTube. Please verify that your TV is connected to the internet and check your network settings.</p>
      <button id="retry-btn" style="background-color: #ff0000; color: #fff; border: none; padding: 1rem 3rem; font-size: 1.2rem; font-weight: bold; border-radius: 50px; cursor: pointer; outline: none; box-shadow: 0 4px 20px rgba(255, 0, 0, 0.4); transform: scale(1); transition: all 0.2s ease;">Retry Connection</button>
      <p id="retry-countdown" style="margin-top: 1.5rem; font-size: 1rem; color: #666; text-align: center;">Retrying automatically in 5 seconds...</p>
      <style>
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.08); }
          100% { transform: scale(1); }
        }
        #retry-btn:focus, #retry-btn:hover {
          background-color: #cc0000;
          transform: scale(1.08);
          box-shadow: 0 6px 25px rgba(255, 0, 0, 0.6);
        }
      </style>
    </div>
  `;

  const retryBtn = document.getElementById('retry-btn') as HTMLButtonElement;
  if (retryBtn) {
    retryBtn.focus();
    retryBtn.addEventListener('click', () => {
      document.body.innerHTML = '<div style="background-color:#0f0f0f;color:#fff;width:100vw;height:100vh;display:flex;justify-content:center;align-items:center;font-size:1.5rem;">Connecting...</div>';
      setTimeout(fetchAndRewriteYoutube, 500);
    });
  }

  let secondsLeft = 5;
  const countdownText = document.getElementById('retry-countdown') as HTMLParagraphElement;
  const timer = setInterval(() => {
    secondsLeft--;
    if (countdownText) {
      countdownText.textContent = `Retrying automatically in ${secondsLeft} seconds...`;
    }
    if (secondsLeft <= 0) {
      clearInterval(timer);
      if (document.getElementById('tizen-network-error')) {
        document.body.innerHTML = '<div style="background-color:#0f0f0f;color:#fff;width:100vw;height:100vh;display:flex;justify-content:center;align-items:center;font-size:1.5rem;">Connecting...</div>';
        fetchAndRewriteYoutube();
      }
    }
  }, 1000);
}
