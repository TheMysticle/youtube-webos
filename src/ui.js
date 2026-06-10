/*global navigate, __YTAF_VERSION__*/
import './spatial-navigation-polyfill.js';
import {
  configAddChangeListener,
  configRead,
  configWrite,
  configGetDesc
} from './config.js';
import './ui.css';
import { requireElement } from './player_api/helpers';

// We handle key events ourselves.
window.__spatialNavigation__.keyMode = 'NONE';

const ARROW_KEY_CODE = { 37: 'left', 38: 'up', 39: 'right', 40: 'down' };

const colorCodeMap = new Map([
  [403, 'red'],

  [404, 'green'],
  [172, 'green'],

  [405, 'yellow'],
  [170, 'yellow'],

  [406, 'blue'],
  [167, 'blue'],
  [191, 'blue']
]);

const colorKeyNameMap = new Map([
  ['colorf0red', 'red'],
  ['red', 'red'],
  ['xf86red', 'red'],
  ['colorf1green', 'green'],
  ['green', 'green'],
  ['xf86green', 'green'],
  ['colorf2yellow', 'yellow'],
  ['yellow', 'yellow'],
  ['xf86yellow', 'yellow'],
  ['colorf3blue', 'blue'],
  ['blue', 'blue'],
  ['xf86blue', 'blue']
]);

/**
 * Returns the name of the color button associated with a code or null if not a color button.
 * @param {KeyboardEvent} evt Keyboard event from event listener
 * @returns {string | null} Color name or null
 */
function getKeyColor(evt) {
  const keyCode = evt.keyCode || evt.which;
  if (colorCodeMap.has(keyCode)) {
    return colorCodeMap.get(keyCode);
  }

  const keyName = String(evt.key || '').toLowerCase();
  if (keyName && colorKeyNameMap.has(keyName)) {
    return colorKeyNameMap.get(keyName);
  }

  const codeName = String(evt.code || '').toLowerCase();
  if (codeName && colorKeyNameMap.has(codeName)) {
    return colorKeyNameMap.get(codeName);
  }

  return null;
}

const TIZEN_SETTINGS_KEYS = [
  'enableAdBlock',
  'upgradeThumbnails',
  'hideLogo',
  'showWatch',
  'removeShorts',
  'forceHighResVideo',
  'removeEndscreen',
  'autoAccountSelect',
  'enableSponsorBlock',
  'enableSponsorBlockSponsor',
  'enableSponsorBlockIntro',
  'enableSponsorBlockOutro',
  'enableSponsorBlockInteraction',
  'enableSponsorBlockSelfPromo',
  'enableSponsorBlockMusicOfftopic',
  'enableSponsorBlockPreview'
];

// These keys are wired for live updates without requiring a full app reload.
const HOT_APPLY_SETTINGS_KEYS = new Set([
  'hideLogo',
  'upgradeThumbnails'
]);

let optionsPanelVisible = false;
let optionsSelectedIndex = 0;
let optionsRequireReload = false;
const optionRows = [];

function createOptionsPanel() {
  const overlay = document.createElement('div');
  overlay.id = 'ytaf-options-overlay';
  overlay.style.cssText = `
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.65);
    z-index: 2147483647;
    pointer-events: auto;
    font-family: sans-serif;
  `;

  const panel = document.createElement('div');
  panel.id = 'ytaf-options-panel';
  panel.style.cssText = `
    position: absolute;
    top: 50%;
    left: 50%;
    width: min(1100px, 92vw);
    height: min(85vh, 900px);
    transform: translate(-50%, -50%);
    background: #111;
    color: #fff;
    border: 2px solid #00b050;
    border-radius: 14px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.75);
    padding: 24px;
    box-sizing: border-box;
    overflow-y: auto;
  `;

  const title = document.createElement('div');
  title.textContent = `YouTube AdFree Settings  v${__YTAF_VERSION__}`;
  title.style.cssText = 'font-size: 34px; font-weight: 700; margin-bottom: 12px;';
  panel.appendChild(title);

  const hint = document.createElement('div');
  hint.textContent = 'Use UP/DOWN to select, OK to toggle, GREEN/BACK to close';
  hint.style.cssText = 'font-size: 18px; color: #9ad9ab; margin-bottom: 16px;';
  panel.appendChild(hint);

  const list = document.createElement('div');
  list.style.cssText = 'display: flex; flex-direction: column; gap: 10px;';

  TIZEN_SETTINGS_KEYS.forEach((key) => {
    const row = document.createElement('div');
    row.dataset.key = key;
    row.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 14px;
      border-radius: 10px;
      border: 2px solid #333;
      background: #1a1a1a;
      font-size: 21px;
    `;

    const label = document.createElement('span');
    label.textContent = configGetDesc(key);
    label.style.cssText = 'padding-right: 12px;';

    const value = document.createElement('span');
    value.dataset.role = 'value';
    value.style.cssText = 'font-weight: 700; min-width: 80px; text-align: right;';

    row.appendChild(label);
    row.appendChild(value);
    list.appendChild(row);
    optionRows.push(row);

    configAddChangeListener(key, () => {
      const valElm = row.querySelector('[data-role="value"]');
      const enabled = Boolean(configRead(key));
      if (valElm) {
        valElm.textContent = enabled ? 'ON' : 'OFF';
        valElm.style.color = enabled ? '#4dff7a' : '#ff6c6c';
      }
    });
  });

  panel.appendChild(list);
  overlay.appendChild(panel);
  return overlay;
}

const optionsPanel = createOptionsPanel();

function ensureOptionsPanelMounted() {
  if (!document.body) return false;

  if (optionsPanel.parentElement !== document.body) {
    document.body.appendChild(optionsPanel);
  }

  return true;
}

function renderOptionsPanel() {
  optionRows.forEach((row, idx) => {
    const key = row.dataset.key;
    const enabled = Boolean(configRead(key));
    const valueElm = row.querySelector('[data-role="value"]');

    if (valueElm) {
      valueElm.textContent = enabled ? 'ON' : 'OFF';
      valueElm.style.color = enabled ? '#4dff7a' : '#ff6c6c';
    }

    const selected = idx === optionsSelectedIndex;
    row.style.borderColor = selected ? '#ffffff' : '#333';
    row.style.background = selected ? '#2a3f2d' : '#1a1a1a';
  });
}

function moveSelectedOption(delta) {
  const max = optionRows.length - 1;
  optionsSelectedIndex = Math.max(0, Math.min(max, optionsSelectedIndex + delta));
  renderOptionsPanel();

  const selectedRow = optionRows[optionsSelectedIndex];
  if (selectedRow) {
    selectedRow.scrollIntoView({ block: 'nearest' });
  }
}

function toggleSelectedOption() {
  const selectedRow = optionRows[optionsSelectedIndex];
  if (!selectedRow) return;

  const key = selectedRow.dataset.key;
  const nextValue = !Boolean(configRead(key));
  configWrite(key, nextValue);

  if (!HOT_APPLY_SETTINGS_KEYS.has(key)) {
    optionsRequireReload = true;
  }
  
  if (key === 'hideLogo' && configRead('showWatch')) {
    optionsRequireReload = true;
  }

  renderOptionsPanel();
}

if (!ensureOptionsPanelMounted()) {
  document.addEventListener('DOMContentLoaded', ensureOptionsPanelMounted);
  const mountTimer = setInterval(() => {
    if (ensureOptionsPanelMounted()) {
      clearInterval(mountTimer);
    }
  }, 100);
}

function showOptionsPanel(visible) {
  visible ??= true;

  if (visible && !optionsPanelVisible) {
    ensureOptionsPanelMounted();
    document.body.appendChild(optionsPanel);
    optionsPanel.style.setProperty('display', 'block', 'important');
    optionsSelectedIndex = 0;
    optionsRequireReload = false;
    renderOptionsPanel();
    optionsPanelVisible = true;
  } else if (!visible && optionsPanelVisible) {
    optionsPanel.style.setProperty('display', 'none', 'important');
    optionsPanelVisible = false;

    if (optionsRequireReload) {
      showNotification('Applying settings...', 1200, 'green');
      setTimeout(() => {
        if (window.ytaf_reloadApp) {
          window.ytaf_reloadApp();
        } else {
          window.location.reload();
        }
      }, 200);
    }
  }
}

window.ytaf_showOptionsPanel = showOptionsPanel;

let ytafInspectorEnabled = false;
let ytafInspectorContainer = null;

function toggleInspector() {
  ytafInspectorEnabled = !ytafInspectorEnabled;
  if (!ytafInspectorEnabled) {
    if (ytafInspectorContainer) {
      ytafInspectorContainer.remove();
      ytafInspectorContainer = null;
    }
    showNotification('Overlay Inspector Disabled', 2000, 'yellow');
    return;
  }
  
  showNotification('Overlay Inspector Enabled', 2000, 'yellow');
  
  ytafInspectorContainer = document.createElement('div');
  ytafInspectorContainer.id = 'ytaf-inspector-container';
  ytafInspectorContainer.style.cssText = 'position: fixed; inset: 0; pointer-events: none; z-index: 2147483647;';
  document.body.appendChild(ytafInspectorContainer);

  const result = [];
  function getAllElements(root) {
    if (!root) return;
    const elements = root.querySelectorAll('*');
    elements.forEach(el => {
      result.push(el);
      if (el.shadowRoot) {
        getAllElements(el.shadowRoot);
      }
    });
  }
  getAllElements(document.documentElement);

  // We only want overlays (absolute, fixed) that are visible.
  result.forEach(el => {
    if (el.id === 'ytaf-inspector-container') return;
    if (el.id === 'ytaf-debug-console') return;
    if (el.id === 'ytaf-options-overlay') return;
    
    try {
      const style = window.getComputedStyle(el);
      if ((style.position === 'absolute' || style.position === 'fixed') && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 && rect.width < window.innerWidth * 0.95 && rect.height < window.innerHeight * 0.95) {
          // Draw box
          const box = document.createElement('div');
          box.style.cssText = `
            position: absolute;
            left: ${rect.left}px;
            top: ${rect.top}px;
            width: ${rect.width}px;
            height: ${rect.height}px;
            border: 2px solid yellow;
            pointer-events: none;
            box-sizing: border-box;
            background-color: rgba(255, 255, 0, 0.1);
          `;
          
          const label = document.createElement('div');
          let name = el.tagName.toLowerCase();
          if (el.id) name += '#' + el.id;
          if (el.className && typeof el.className === 'string') name += '.' + el.className.trim().replace(/\s+/g, '.');
          
          label.innerText = name;
          label.style.cssText = `
            position: absolute;
            left: 0;
            top: 0;
            background: yellow;
            color: black;
            font-size: 14px;
            font-family: monospace;
            padding: 2px 4px;
            white-space: nowrap;
          `;
          
          box.appendChild(label);
          ytafInspectorContainer.appendChild(box);
        }
      }
    } catch (e) {}
  });
}

const eventHandler = (evt) => {
  const keyCode = evt.keyCode || evt.which;
  const keyColor = getKeyColor(evt);

  if (optionsPanelVisible) {
    // If options panel is open, hijack keys to prevent YouTube from reacting
    if (keyColor === 'green') {
      if (evt.type === 'keydown') {
        showOptionsPanel(false);
      }
      evt.preventDefault();
      evt.stopPropagation();
      return false;
    }

    if (evt.type === 'keydown' && keyCode === 38) {
      moveSelectedOption(-1);
      evt.preventDefault();
      evt.stopPropagation();
      return false;
    }

    if (evt.type === 'keydown' && keyCode === 40) {
      moveSelectedOption(1);
      evt.preventDefault();
      evt.stopPropagation();
      return false;
    }

    if (evt.type === 'keydown' && (keyCode === 13 || keyCode === 32 || keyCode === 37 || keyCode === 39)) {
      toggleSelectedOption();
      evt.preventDefault();
      evt.stopPropagation();
      return false;
    }

    if (keyCode === 27 || keyCode === 10009) { // Escape / Back / Return
      if (evt.type === 'keydown') {
        showOptionsPanel(false);
      }
      evt.preventDefault();
      evt.stopPropagation();
      return false;
    }

    // Block all other keys in capturing phase when panel is open
    evt.preventDefault();
    evt.stopPropagation();
    return false;
  }

  // Normal mode
  if (keyColor === 'green') {
    if (evt.type === 'keydown') {
      showOptionsPanel(!optionsPanelVisible);
    }
    evt.preventDefault();
    evt.stopPropagation();
    return false;
  } else if (keyColor === 'red') {
    if (evt.type === 'keydown') {
      const consoleElm = document.getElementById('ytaf-debug-console');
      if (consoleElm) {
        if (consoleElm.style.display === 'none') {
          consoleElm.style.display = 'block';
          showNotification('Debug console shown', 2000, 'red');
        } else {
          consoleElm.style.display = 'none';
          showNotification('Debug console hidden', 2000, 'red');
        }
      }
    }
    evt.preventDefault();
    evt.stopPropagation();
    return false;
  } else if (keyColor === 'blue') {
    if (evt.type === 'keydown') {
      initAudioOnlyToggle();
    }
    evt.preventDefault();
    evt.stopPropagation();
    return false;
  } else if (keyColor === 'yellow') {
    if (evt.type === 'keydown') {
      toggleInspector();
    }
    evt.preventDefault();
    evt.stopPropagation();
    return false;
  }
  return true;
};

document.addEventListener('keydown', eventHandler, true);
document.addEventListener('keypress', eventHandler, true);
document.addEventListener('keyup', eventHandler, true);

const COLOR_MAP = {
  red: 'rgba(255, 0, 0, 0.9)',
  green: 'rgba(0, 162, 0, 0.9)',
  yellow: 'rgba(255, 255, 0, 0.9)',
  blue: 'rgba(0, 128, 255, 0.9)',
  indigo: 'rgba(99, 102, 241, 0.9)',
  grey: 'rgba(255, 255, 255, 0.5)',
  none: 'rgba(0, 0, 0, 0)'
};

export function showNotification(text, time = 3000, color = 'grey') {
  if (!document.querySelector('.ytaf-notification-container')) {
    console.debug('Adding notification container');
    const c = document.createElement('div');
    c.classList.add('ytaf-notification-container');
    document.body.appendChild(c);
  }

  const elm = document.createElement('div');
  const elmInner = document.createElement('div');
  elmInner.innerText = text;
  elmInner.classList.add('message');
  elmInner.classList.add('message-hidden');
  elm.appendChild(elmInner);
  document.querySelector('.ytaf-notification-container').appendChild(elm);
  elmInner.style.borderColor = COLOR_MAP[color] || color;

  setTimeout(() => {
    elmInner.classList.remove('message-hidden');
  }, 100);
  setTimeout(() => {
    elmInner.classList.add('message-hidden');
    setTimeout(() => {
      elm.remove();
    }, 1000);
  }, time);
}

/**
 * Initialize ability to hide YouTube logo in top right corner.
 */
function initHideLogo() {
  const style = document.createElement('style');
  document.head.appendChild(style);

  /** @type {(hide: boolean) => void} */
  const setHidden = (hide) => {
    const visibility = hide ? 'hidden' : 'visible';
    style.textContent = `ytlr-redux-connect-ytlr-logo-entity { visibility: ${visibility}; }`;
  };

  setHidden(configRead('hideLogo'));

  configAddChangeListener('hideLogo', (evt) => {
    setHidden(evt.detail.newValue);
  });
}

function applyUIFixes() {
  try {
    const bodyClasses = document.body.classList;

    const observer = new MutationObserver(function bodyClassCallback(
      _records,
      _observer
    ) {
      try {
        if (bodyClasses.contains('app-quality-root')) {
          bodyClasses.remove('app-quality-root');
        }
      } catch (e) {
        console.error('error in <body> class observer callback:', e);
      }
    });

    observer.observe(document.body, {
      subtree: false,
      childList: false,
      attributes: true,
      attributeFilter: ['class'],
      characterData: false
    });
  } catch (e) {
    console.error('error setting up <body> class observer:', e);
  }
}

let audioOnlyEnabled = false;
let overlayObserver = null;

async function initAudioOnlyToggle() {
  const elVideo = await requireElement('video', HTMLVideoElement);

  audioOnlyEnabled = !audioOnlyEnabled;
  elVideo.style.visibility = audioOnlyEnabled ? 'hidden' : '';

  const AUDIO_OVERLAY_SELECTOR = '.ytLrAudioPlayerOverlayAudioMode';
  const YTAF_OVERLAY_CLASS = 'ytaf-ui-watchControl-overlayMessage';

  const applyAudioOverlayFilter = () => {
    const node = document.querySelector(AUDIO_OVERLAY_SELECTOR);
    if (!node) return;
    if (audioOnlyEnabled) {
      node.style.setProperty('filter', 'brightness(0)', 'important');
    } else {
      node.style.removeProperty('filter');
    }
  };
  applyAudioOverlayFilter();

  showNotification(
    `Audio-Only mode: ${audioOnlyEnabled ? 'Enabled' : 'Disabled'}`,
    2000,
    'blue'
  );

  const controlsContainer = await requireElement(
    '[idomkey="controls"]',
    HTMLElement
  );

  const updateOverlay = (root = controlsContainer) => {
    let overlay = root.querySelector(`.${YTAF_OVERLAY_CLASS}`);

    if (!audioOnlyEnabled) {
      overlay?.remove();
      return;
    }

    if (overlay) return;

    overlay = Object.assign(document.createElement('div'), {
      textContent: 'Audio-Only Mode Enabled - Press [BLUE] to toggle',
      className: YTAF_OVERLAY_CLASS
    });
    root.prepend(overlay);
  };
  updateOverlay();

  if (overlayObserver) overlayObserver.disconnect();
  overlayObserver = new MutationObserver(() => {
    updateOverlay();
    applyAudioOverlayFilter();
  });

  overlayObserver.observe(controlsContainer, {
    childList: true,
    subtree: true
  });
}

const runUIInit = () => {
  applyUIFixes();
  initHideLogo();
};

if (document.body) {
  runUIInit();
} else {
  document.addEventListener('DOMContentLoaded', runUIInit);
}

setTimeout(() => {
  showNotification(
    'Press [GREEN] to open YTAF configuration screen',
    2000,
    'green'
  );
});
