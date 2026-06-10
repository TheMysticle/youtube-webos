import './debug-console';
import 'whatwg-fetch';
import './domrect-polyfill';

import { handleLaunch } from './utils';

document.addEventListener(
  'webOSRelaunch',
  (evt) => {
    console.info('RELAUNCH:', evt, window.launchParams);
    handleLaunch((evt as CustomEvent).detail);
  },
  true
);

if (typeof window !== 'undefined') {
  window.addEventListener('appcontrol', () => {
    try {
      const reqAppControl = window.tizen?.application?.getCurrentApplication()?.getRequestedAppControl();
      if (reqAppControl && reqAppControl.appControl) {
        const appControl = reqAppControl.appControl;
        const params: Record<string, any> = {};
        if (appControl.data) {
          appControl.data.forEach((item: any) => {
            params[item.key] = item.value && item.value.length === 1 ? item.value[0] : item.value;
          });
        }
        console.info('[TizenLoader] appcontrol relaunch received:', params);
        handleLaunch(params);
      }
    } catch (e) {
      console.error('Tizen appcontrol relaunch error:', e);
    }
  });
}

import './app_api/index';
import './adblock.js';
import './hooks/json-stringify';
import './shorts.js';
import './sponsorblock.js';
import './ui.js';
import './font-fix.css';
import './thumbnail-quality';
import './screensaver-fix';
import './yt-fixes.css';
import './watch.js';
import './video-quality';
import './lang-settings-fix';
import './remove-endscreen';
import './hooks';
import './block-webos-cast';
import './auto-account-select';

// Hide the "NO DEBUG ACCESS" warning in the bottom left
function initHideDebugWarning() {
  if (typeof document === 'undefined') return;

  const isDebugWarningText = (value: string | null | undefined) => {
    if (!value) return false;
    return /(NO\s+DEBUG\s+ACCESS|DEBUG\s+ACCESS\s+DOMAIN)/i.test(value);
  };

  const pickHideTarget = (el: HTMLElement) => {
    let node: HTMLElement | null = el;
    while (node && node !== document.body && node !== document.documentElement) {
      const style = window.getComputedStyle(node);
      if (style.position === 'fixed' || style.position === 'absolute') {
        return node;
      }
      node = node.parentElement;
    }
    return el;
  };

  const hideElement = (el: HTMLElement) => {
    el.style.setProperty('display', 'none', 'important');
    el.style.setProperty('visibility', 'hidden', 'important');
    el.style.setProperty('opacity', '0', 'important');
    el.style.setProperty('pointer-events', 'none', 'important');
  };

  const isLikelyRedDebugOverlay = (el: HTMLElement) => {
    const style = window.getComputedStyle(el);
    if (!(style.position === 'fixed' || style.position === 'absolute')) return false;

    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;

    const isBottomLeft = rect.left <= 120 && window.innerHeight - rect.bottom <= 120;
    const isSmallBanner = rect.width <= 1000 && rect.height <= 260;
    const bg = style.backgroundColor || '';
    const looksRed = /rgba?\(\s*(1\d\d|2\d\d|255)\s*,\s*(\d|[1-8]\d)\s*,\s*(\d|[1-8]\d)/.test(bg);
    const hasDebugText = isDebugWarningText(el.textContent) || /DEBUG|DOMAIN/i.test(el.textContent || '');

    return isBottomLeft && isSmallBanner && (looksRed || hasDebugText);
  };

  const ensureBottomLeftShield = () => {
    const shieldId = 'ytaf-debug-warning-shield';
    let shield = document.getElementById(shieldId) as HTMLDivElement | null;
    if (!shield) {
      shield = document.createElement('div');
      shield.id = shieldId;
      shield.style.cssText = `
        position: fixed;
        left: 0;
        bottom: 0;
        width: 1100px;
        height: 260px;
        background: #000;
        z-index: 2147483647;
        pointer-events: none;
        opacity: 1;
      `;
      document.body.appendChild(shield);
    }
  };

  const collectTextWarningNodes = (root: Node, nodesToHide: Set<HTMLElement>) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    let node;
    while ((node = walker.nextNode())) {
      if (isDebugWarningText(node.nodeValue)) {
        const parent = node.parentElement;
        if (parent && parent !== document.body && parent !== document.documentElement) {
          nodesToHide.add(pickHideTarget(parent));
        }
      }
    }
  };

  const checkAndHide = () => {
    try {
      let hiddenCount = 0;
      const nodesToHide = new Set<HTMLElement>();

      collectTextWarningNodes(document.body || document.documentElement, nodesToHide);

      document.querySelectorAll<HTMLElement>('*').forEach((el) => {
        if (el.shadowRoot) {
          collectTextWarningNodes(el.shadowRoot, nodesToHide);
          // Aggressively hunt down yt-debug-watermark in shadow DOMs
          el.shadowRoot.querySelectorAll('yt-debug-watermark, .H3qzme').forEach((child) => {
            hideElement(child as HTMLElement);
          });
        }
      });

      // Also check light DOM
      document.querySelectorAll('yt-debug-watermark, .H3qzme').forEach((child) => {
        hideElement(child as HTMLElement);
      });

      nodesToHide.forEach((el) => {
        if (el.style.display !== 'none') {
          hiddenCount += 1;
        }
        hideElement(el);
      });

      // Fallback pass: hide direct elements whose own text content matches warning text.
      const allElements = document.querySelectorAll<HTMLElement>('body *');
      allElements.forEach((el) => {
        if (isDebugWarningText(el.textContent)) {
          const target = pickHideTarget(el);
          if (target.style.display !== 'none') {
            hiddenCount += 1;
          }
          hideElement(target);
        }

        if (isLikelyRedDebugOverlay(el)) {
          if (el.style.display !== 'none') {
            hiddenCount += 1;
          }
          hideElement(el);
        }
      });

      // Fallback: force-cover bottom-left area where Samsung browser warning appears.
      ensureBottomLeftShield();
    } catch (e) {
      console.error('Error checking/hiding debug warning:', e);
    }
  };

  // Run check immediately and periodically
  checkAndHide();
  setInterval(checkAndHide, 350);

  // Monitor DOM modifications
  const observer = new MutationObserver(() => {
    checkAndHide();
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
}

try {
  initHideDebugWarning();
} catch (e) {
  console.error('Failed to initialize debug warning hider:', e);
}
