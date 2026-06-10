import './debug-console';
import './watch.js';
import { extractLaunchParams, handleLaunch } from './utils';
import { runTizenLoader } from './tizen-loader';

window.addEventListener('appcontrol', () => {
  if (typeof window !== 'undefined' && window.tizen) {
    handleLaunch(extractLaunchParams());
    runTizenLoader();
  } else {
    handleLaunch(extractLaunchParams());
  }
});

function main() {
  if (typeof window !== 'undefined' && window.tizen) {
    handleLaunch(extractLaunchParams());
    runTizenLoader();
  } else {
    handleLaunch(extractLaunchParams());
  }
}

main();
