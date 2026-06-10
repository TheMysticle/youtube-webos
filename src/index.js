import './debug-console';
import { extractLaunchParams, handleLaunch } from './utils';
import { runTizenLoader } from './tizen-loader';

function main() {
  if (typeof window !== 'undefined' && window.tizen) {
    handleLaunch(extractLaunchParams());
    runTizenLoader();
  } else {
    handleLaunch(extractLaunchParams());
  }
}

main();
