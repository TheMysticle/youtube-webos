import { configRead, configAddChangeListener } from './config';
import './watch.css';
import { requireElement } from './player_api/helpers';

class Watch {
  #watch;
  #mountTimer;
  #attrChanges;
  #PLAYER_SELECTOR = 'ytlr-watch-default';
  #isVisible = true;

  constructor() {
    this.init();
    this.playerEvents();
  }

  init() {
    if (typeof document === 'undefined') return;

    const createDiv = () => {
      if (document.getElementById('ytaf-clock-widget')) return;
      this.#watch = document.createElement('div');
      this.#watch.id = 'ytaf-clock-widget';
      this.#watch.style.cssText = `
        position: fixed;
        right: 0;
        top: 0;
        margin: 1rem 2rem;
        background-color: rgba(0, 0, 0, 0.65);
        border-radius: 0.5rem;
        padding: 0.4rem;
        font-size: 1.2rem;
        color: #fff;
        z-index: 2147483647;
        pointer-events: none;
        letter-spacing: 0.05rem;
        font-family: sans-serif;
        display: ${this.#isVisible ? 'block' : 'none'};
      `;
      document.body.appendChild(this.#watch);
    };

    if (document.body) {
      createDiv();
    } else {
      document.addEventListener('DOMContentLoaded', createDiv);
    }

    const formatter = new Intl.DateTimeFormat(navigator.language, {
      hour: 'numeric',
      minute: 'numeric'
    });

    const setTime = () => {
      if (this.#watch) {
        const now = new Date();
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        this.#watch.innerText = `${hours}:${minutes}`;
      }
    };

    setTime();
    // Update every 10 seconds to ensure we don't miss the minute change
    this.#mountTimer = setInterval(() => {
      setTime();
      if (document.body && (!this.#watch || this.#watch.parentElement !== document.body)) {
        createDiv();
        setTime();
      }
    }, 10000);
  }

  changeVisibility(video) {
    const focused = video.getAttribute('hybridnavfocusable') === 'true';
    this.#isVisible = !focused;
    if (this.#watch) {
      this.#watch.style.display = this.#isVisible ? 'block' : 'none';
    }
  }

  async playerEvents() {
    const player = await requireElement(this.#PLAYER_SELECTOR, HTMLElement);
    this.changeVisibility(player);
    
    this.#attrChanges = new MutationObserver(() => {
      this.changeVisibility(player);
    });

    this.#attrChanges.observe(player, {
      attributes: true,
      attributeFilter: ['hybridnavfocusable']
    });
  }

  destroy() {
    clearInterval(this.#mountTimer);
    if (this.#watch) {
      this.#watch.remove();
    }
    if (this.#attrChanges) {
      this.#attrChanges.disconnect();
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
