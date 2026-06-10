import { configRead, configAddChangeListener } from './config';

class Watch {
  constructor() {
    this._watch = null;
    this._mountTimer = null;
    this.init();
  }

  init() {
    if (typeof document === 'undefined') return;

    const createDiv = () => {
      const existing = document.getElementById('ytaf-clock-widget');
      if (existing) {
        this._watch = existing;
        return;
      }
      this._watch = document.createElement('div');
      this._watch.id = 'ytaf-clock-widget';
      
      const hideLogo = configRead('hideLogo');
      
      this._watch.style.cssText = `
        position: fixed;
        top: 76px;
        right: ${hideLogo ? '76px' : '360px'};
        width: 120px;
        height: 50px;
        line-height: 50px;
        text-align: center;
        background-color: rgba(0, 0, 0, 0.85);
        color: #ffffff;
        font-family: 'Roboto', 'YouTube Noto', sans-serif;
        font-size: 26px;
        font-weight: bold;
        border: 2px solid #333;
        border-radius: 8px;
        z-index: 2147483647;
        pointer-events: none;
        box-shadow: 0 0 20px rgba(0, 0, 0, 0.6);
        display: block;
      `;
      document.body.appendChild(this._watch);
    };

    if (document.body) {
      createDiv();
    } else {
      document.addEventListener('DOMContentLoaded', createDiv);
      const checkTimer = setInterval(() => {
        if (document.body) {
          createDiv();
          clearInterval(checkTimer);
        }
      }, 100);
    }



    const setTime = () => {
      if (this._watch) {
        const now = new Date();
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        this._watch.innerText = `${hours}:${minutes}`;
      }
    };

    setTime();
    this._mountTimer = setInterval(() => {
      setTime();
      if (document.body && (!this._watch || this._watch.parentElement !== document.body)) {
        createDiv();
        setTime();
      }
    }, 1000);
  }

  destroy() {
    clearInterval(this._mountTimer);
    if (this._watch) {
      this._watch.remove();
      this._watch = null;
    }
  }
}

let watchInstance = null;

function toggleWatch(show) {
  if (show) {
    watchInstance = watchInstance ? watchInstance : new Watch();
  } else {
    watchInstance?.destroy();
    watchInstance = null;
  }
}

toggleWatch(configRead('showWatch'));

configAddChangeListener('showWatch', (evt) => {
  toggleWatch(evt.detail.newValue);
});
