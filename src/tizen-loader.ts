// Tizen standalone loader script for YouTube TV

declare global {
  interface Window {
    tizen?: any;
    tizenLoaderExecuted?: boolean;
    tizenInitialURL?: string;
    ytaf_showOptionsPanel?: (visible?: boolean) => void;
    ytaf_reloadApp?: () => void;
  }
}

import { PROXY_IP } from './proxy-config';

function showProxyError() {
  if ((window as any).proxyErrorShown) return;
  (window as any).proxyErrorShown = true;
  
  const inject = () => {
    if (!document.body) {
      setTimeout(inject, 500);
      return;
    }
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.85);
      z-index: 9999999;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'YouTube Noto', Roboto, Arial, sans-serif;
    `;
    const modal = document.createElement('div');
    modal.style.cssText = `
      background: #181818;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 40px;
      max-width: 500px;
      text-align: center;
      box-shadow: 0 20px 40px rgba(0,0,0,0.8);
      color: #fff;
    `;
    modal.innerHTML = `
      <h1 style="margin: 0 0 20px 0; font-size: 26px; font-weight: 500; color: #ff4e45;">Proxy Unreachable</h1>
      <p style="font-size: 16px; line-height: 1.5; margin-bottom: 24px; color: #aaa;">
        This older TV requires a proxy server to bypass Google's API firewall. We couldn't connect to it!
      </p>
      <div style="background: #212121; border-radius: 8px; padding: 20px; margin-bottom: 20px; text-align: left; border: 1px solid rgba(255,255,255,0.05);">
        <p style="margin: 0 0 12px 0; font-size: 15px; color: #ddd;">1. Run the Node.js proxy server on your PC.</p>
        <p style="margin: 0; font-size: 15px; color: #ddd;">2. Ensure your PC's IP matches <strong>${PROXY_IP}</strong>.</p>
      </div>
      <p style="font-size: 14px; color: #888; margin-bottom: 30px; line-height: 1.4;">
        (You can find the proxy server script and more info on the project's GitHub page)
      </p>
      <button id="yt-proxy-dismiss" style="
        background: #f1f1f1;
        color: #0f0f0f;
        border: none;
        border-radius: 18px;
        padding: 10px 24px;
        font-size: 16px;
        font-weight: 500;
        cursor: pointer;
        outline: none;
      ">Understood</button>
    `;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const btn = overlay.querySelector('#yt-proxy-dismiss') as HTMLButtonElement;
    if (btn) {
      btn.focus();
      btn.style.border = '2px solid transparent';
      btn.onfocus = () => btn.style.border = '2px solid #3ea6ff';
      btn.onblur = () => btn.style.border = '2px solid transparent';
      btn.onclick = () => overlay.remove();
      btn.onkeydown = (e) => {
        if (e.key === 'Enter') overlay.remove();
      };
    }
  };
  inject();
}

export async function runTizenLoader() {
  console.info('[TizenLoader] Starting loader...');

  // 1. Setup global flags
  window.tizenLoaderExecuted = false;

  window.ytaf_reloadApp = () => {
    console.info('[TizenLoader] Reloading app context...');
    const localAppPath = window.location.href.split('#')[0];
    window.location.href = localAppPath;
  };

  try {
    const originalReload = Location.prototype.reload;
    Location.prototype.reload = function() {
      console.info('[TizenLoader] Intercepted Location.prototype.reload()');
      if (window.tizen) {
        window.ytaf_reloadApp!();
      } else {
        originalReload.call(this);
      }
    };
  } catch(e) {
    console.warn('[TizenLoader] Failed to monkey-patch Location.prototype.reload', e);
  }

  // Helper to log to debug console safely
  const logToDebug = (msg: string) => {
    if ((window as any).debugConsole) {
      (window as any).debugConsole.log(msg);
    } else {
      console.debug(msg);
    }
  };

  // Polyfill document.cookie for file:// protocol on older Tizen WebKit engines
  if (window.location.protocol === 'file:') {
    try {
      let cookieStore = '';
      // Try to load from localStorage if available
      try { cookieStore = window.localStorage.getItem('ytaf_cookie_polyfill') || ''; } catch (e) {}
      
      Object.defineProperty(document, 'cookie', {
        get() {
          return cookieStore;
        },
        set(value) {
          if (!value) return;
          const newCookie = value.split(';')[0];
          const newKey = newCookie.split('=')[0].trim();
          
          let cookies = cookieStore ? cookieStore.split('; ') : [];
          // Remove old cookie with same key
          cookies = cookies.filter(c => c.split('=')[0].trim() !== newKey);
          cookies.push(newCookie.trim());
          
          cookieStore = cookies.join('; ');
          try { window.localStorage.setItem('ytaf_cookie_polyfill', cookieStore); } catch (e) {}
        },
        configurable: true
      });
      logToDebug('[TizenLoader] Polyfilled document.cookie');
    } catch (e) {
      logToDebug('[TizenLoader] Failed to polyfill document.cookie: ' + e);
    }
  }

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
    
    // Fix malformed URLs caused by YouTube JS reading window.location.hostname on file://
    if (urlStr.startsWith('https:///')) {
      urlStr = urlStr.replace('https:///', 'https://www.youtube.com/');
    }
    if (urlStr.startsWith('http:///')) {
      urlStr = urlStr.replace('http:///', 'http://www.youtube.com/');
    }
    
    // Fix URL-encoded malformed URLs appended to file://
    if (urlStr.match(/^file:\/\/https(%3a|%3A)\/\/\//i)) {
      urlStr = urlStr.replace(/^file:\/\/https(%3a|%3A)\/\/\//i, 'https://www.youtube.com/');
    }
    if (urlStr.match(/^file:\/\/http(%3a|%3A)\/\/\//i)) {
      urlStr = urlStr.replace(/^file:\/\/http(%3a|%3A)\/\/\//i, 'http://www.youtube.com/');
    }

    if (
      urlStr &&
      !urlStr.startsWith('http://') &&
      !urlStr.startsWith('https://') &&
      !urlStr.startsWith('file://') &&
      !urlStr.startsWith('data:')
    ) {
      const newUrl = new URL(urlStr, 'https://www.youtube.com');
      logToDebug(`[FETCH-REDIR] ${urlStr} -> ${newUrl.toString()}`);
      if (typeof input === 'string') {
        input = newUrl.toString();
      } else if (input instanceof URL) {
        input = newUrl;
      } else if (input && typeof input === 'object' && 'url' in input) {
        (input as any).url = newUrl.toString();
      }
      urlStr = newUrl.toString();
    }
    
    // Inject Visitor ID and Auth Token to fix 403 on youtubei endpoints when cookies aren't sent
    const isOldTizen = navigator.userAgent.includes('Tizen 5.') || navigator.userAgent.includes('Tizen 4.') || navigator.userAgent.includes('Tizen 3.');
    const needsProxy = isOldTizen;

    if (needsProxy && !(window as any).ytaf_proxy_warned) {
      (window as any).ytaf_proxy_warned = true;
      const warnTimer = setInterval(() => {
        if (document.body) {
          clearInterval(warnTimer);
          const warnDiv = document.createElement('div');
          warnDiv.style.cssText = 'position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: rgba(255, 165, 0, 0.9); color: black; padding: 12px 24px; border-radius: 12px; z-index: 2147483647; font-family: sans-serif; font-weight: bold; font-size: 18px; pointer-events: none;';
          warnDiv.innerText = 'YTAF: Running in Proxy Mode (Older Tizen detected)';
          document.body.appendChild(warnDiv);
          setTimeout(() => {
            warnDiv.style.transition = 'opacity 1s';
            warnDiv.style.opacity = '0';
            setTimeout(() => warnDiv.remove(), 1000);
          }, 8000);
        }
      }, 500);
    }

    if (urlStr && urlStr.includes('/youtubei/')) {
      if (needsProxy) {
        // PROXY the request through the PC to strip the Origin: file:// header
        const targetUrl = encodeURIComponent(urlStr.startsWith('http') ? urlStr : 'https://www.youtube.com' + urlStr);
        urlStr = `http://${PROXY_IP}:3000/proxy?url=${targetUrl}`;
        logToDebug(`[PROXY-FETCH] ${urlStr}`);
      }
    }

    return originalFetch.call(this, input, init);
  };

  // 3. Monkey-patch XMLHttpRequest to intercept relative requests
  const originalOpen = window.XMLHttpRequest.prototype.open;
  window.XMLHttpRequest.prototype.open = function (
    method: string,
    url: string | URL,
    async: boolean = true,
    user?: string | null,
    password?: string | null
  ) {
    let urlStr = typeof url === 'string' ? url : url.toString();
    
    // Fix malformed URLs caused by YouTube JS reading window.location.hostname on file://
    if (urlStr.startsWith('https:///')) {
      urlStr = urlStr.replace('https:///', 'https://www.youtube.com/');
    }
    if (urlStr.startsWith('http:///')) {
      urlStr = urlStr.replace('http:///', 'http://www.youtube.com/');
    }
    
    // Fix URL-encoded malformed URLs appended to file://
    if (urlStr.match(/^file:\/\/https(%3a|%3A)\/\/\//i)) {
      urlStr = urlStr.replace(/^file:\/\/https(%3a|%3A)\/\/\//i, 'https://www.youtube.com/');
    }
    if (urlStr.match(/^file:\/\/http(%3a|%3A)\/\/\//i)) {
      urlStr = urlStr.replace(/^file:\/\/http(%3a|%3A)\/\/\//i, 'http://www.youtube.com/');
    }

    if (
      urlStr &&
      !urlStr.startsWith('http://') &&
      !urlStr.startsWith('https://') &&
      !urlStr.startsWith('file://') &&
      !urlStr.startsWith('data:')
    ) {
      const newUrl = new URL(urlStr, 'https://www.youtube.com');
      logToDebug(`[XHR-REDIR] ${method} ${urlStr} -> ${newUrl.toString()}`);
      url = newUrl.toString();
    } else {
      logToDebug(`[XHR] ${method} ${urlStr}`);
      url = urlStr;
    }
    
    const isOldTizen = navigator.userAgent.includes('Tizen 5.') || navigator.userAgent.includes('Tizen 4.') || navigator.userAgent.includes('Tizen 3.');
    const needsProxy = isOldTizen;

    // PROXY youtubei requests through PC to strip Origin: file:// header
    if (needsProxy && urlStr && urlStr.includes('/youtubei/')) {
      const targetUrl = encodeURIComponent(urlStr.startsWith('http') ? urlStr : 'https://www.youtube.com' + urlStr);
      urlStr = `http://${PROXY_IP}:3000/proxy?url=${targetUrl}`;
      url = urlStr;
      logToDebug(`[PROXY-XHR] ${urlStr}`);
    }

    (this as any)._urlStr = urlStr;
    
    (this as any)._urlStr = urlStr;
    
    // Log failures
    this.addEventListener('load', () => {
      if (this.status >= 400) {
        logToDebug(`[XHR-FAIL] ${this.status} ${urlStr}`);
        try {
          if (this.responseText && this.responseText.length < 1000) {
            logToDebug(`[XHR-FAIL-BODY] ${this.responseText}`);
          }
        } catch (e) {}
      }
    });
    this.addEventListener('error', () => {
      logToDebug(`[XHR-ERROR] ${urlStr}`);
      if (needsProxy && urlStr && urlStr.includes(PROXY_IP)) {
        showProxyError();
      }
    });

    return originalOpen.call(this, method, url, async, user, password);
  };

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

  // 4.5 Monkey-patch createElementNS to neuter the YouTube debug watermark
  const originalCreateElementNS = Document.prototype.createElementNS;
  Document.prototype.createElementNS = function(this: Document, namespace: string | null, qualifiedName: string, options?: string | ElementCreationOptions): Element {
    const element = originalCreateElementNS.call(this, namespace, qualifiedName, options);
    if (String(qualifiedName).toLowerCase() === 'yt-debug-watermark') {
      const originalSetAttribute = element.setAttribute;
      element.setAttribute = function(name: any, value: any) {
        if (String(name).toLowerCase() === 'class' && value) {
          value = String(value).replace(/H3qzme|ZI6Lfc/g, '');
        }
        return originalSetAttribute.call(this, name as string, value as string);
      };
      try { Object.defineProperty(element, 'className', { get() { return ''; }, set() {} }); } catch(e) {}
      if (element instanceof HTMLElement || element instanceof SVGElement) {
        element.style.setProperty('position', 'fixed', 'important');
        element.style.setProperty('top', '-9999px', 'important');
        element.style.setProperty('display', 'none', 'important');
        element.style.setProperty('opacity', '0', 'important');
        element.style.setProperty('pointer-events', 'none', 'important');
        const originalSetProperty = element.style.setProperty;
        element.style.setProperty = function(prop: string, val: string | null, priority?: string) {
          if (['display', 'position', 'top', 'opacity'].includes(prop)) return;
          return originalSetProperty.call(this, prop, val, priority);
        };
      }
    }
    return element;
  };

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
    const userScriptTag = `<script src="${localAppPath}webOSUserScripts/userScript.js?v=${Date.now()}"></script>`;
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
