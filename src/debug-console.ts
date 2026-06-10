// On-screen debug console for Tizen TV
class OnScreenConsole {
  private container: HTMLDivElement | null = null;

  constructor() {
    this.init();
  }

  private init() {
    if (typeof document === 'undefined') return;

    const createDiv = () => {
      if (document.getElementById('ytaf-debug-console')) return;
      this.container = document.createElement('div');
      this.container.id = 'ytaf-debug-console';
      this.container.style.cssText = `
        position: fixed;
        bottom: 10px;
        right: 10px;
        width: 500px;
        height: 300px;
        background-color: rgba(0, 0, 0, 0.85);
        color: #00ff00;
        font-family: monospace;
        font-size: 11px;
        padding: 10px;
        border: 2px solid #333;
        border-radius: 8px;
        overflow-y: auto;
        z-index: 9999999;
        pointer-events: none;
        box-shadow: 0 0 20px rgba(0,0,0,0.5);
      `;
      document.body.appendChild(this.container);
      this.log('=== YTAF On-Screen Debug Console Initialized ===');
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

    const intercept = (name: 'log' | 'info' | 'warn' | 'error' | 'debug') => {
      const original = (console as any)[name];
      (console as any)[name] = (...args: any[]) => {
        if (original) original.apply(console, args);
        this.log(`[${name.toUpperCase()}] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}`);
      };
    };

    intercept('log');
    intercept('info');
    intercept('warn');
    intercept('error');
    intercept('debug');

    window.addEventListener('error', (evt) => {
      this.log(`[UNCAUGHT ERROR] ${evt.message} at ${evt.filename}:${evt.lineno}`);
    });

    window.addEventListener('unhandledrejection', (evt) => {
      this.log(`[UNHANDLED REJECTION] ${evt.reason}`);
    });

    window.addEventListener('keydown', (evt) => {
      this.log(`[KEYDOWN] key="${evt.key}" code="${evt.code}" keyCode=${evt.keyCode} which=${evt.which}`);
    }, true);

    window.addEventListener('keyup', (evt) => {
      this.log(`[KEYUP] key="${evt.key}" code="${evt.code}" keyCode=${evt.keyCode} which=${evt.which}`);
    }, true);
  }

  public log(text: string) {
    if (!this.container) return;
    const line = document.createElement('div');
    line.style.borderBottom = '1px solid #222';
    line.style.padding = '2px 0';
    const time = new Date().toLocaleTimeString();
    line.textContent = `[${time}] ${text}`;
    this.container.appendChild(line);
    
    while (this.container.childNodes.length > 150) {
      this.container.removeChild(this.container.firstChild!);
    }

    // Defer scroll to next event loop tick to ensure layout update completes
    setTimeout(() => {
      if (this.container) {
        this.container.scrollTop = this.container.scrollHeight;
      }
    }, 50);
  }
}

export const debugConsole = new OnScreenConsole();
