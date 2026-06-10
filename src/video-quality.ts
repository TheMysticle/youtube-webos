import { configRead } from './config';
import { getPlayerManager, PlayerMode } from './player_api';
import type { EventMapOf, PlayerManager, VideoID } from './player_api';
import { showNotification } from './ui';

const playerManager = await getPlayerManager();

function shouldForce() {
  return configRead('forceHighResVideo');
}

type EventMap = EventMapOf<PlayerManager>;

function isWatchContext() {
  try {
    const hash = window.location.hash.startsWith('#')
      ? window.location.hash.substring(1)
      : window.location.hash;
    const url = new URL(hash || '/watch', window.location.href);
    return url.pathname === '/watch';
  } catch {
    return window.location.hash.includes('/watch');
  }
}

function qualityRank(label: string) {
  const norm = String(label || '').toLowerCase();
  const baseRanks: Record<string, number> = {
    highres: 100,
    hd2160: 90,
    hd1440: 85,
    hd1080: 80,
    hd720: 70,
    large: 60,
    medium: 50,
    small: 40,
    tiny: 30,
    auto: 1,
  };

  if (norm in baseRanks) return baseRanks[norm];

  const numeric = Number.parseInt(norm, 10);
  if (Number.isFinite(numeric)) return numeric;

  return 0;
}

function getMaxQualityData(player: any) {
  let items = player.getAvailableQualityData ? player.getAvailableQualityData() : [];
  if (!items || !items.length) {
    if (player.getAvailableQualityLevels) {
      const levels = player.getAvailableQualityLevels() || [];
      items = levels.map((l: string) => ({ quality: l, qualityLabel: l }));
    }
  }
  if (!items || !items.length) return undefined;

  const best = [...items].sort(
    (a, b) => qualityRank(b?.qualityLabel ?? b?.quality ?? '') - qualityRank(a?.qualityLabel ?? a?.quality ?? '')
  )[0];

  return best;
}

function notifyPlaybackQuality(this: PlayerManager) {
  if (!shouldForce()) return;

  const player = this.player;

  const selected = player.getPlaybackQualityLabel();
  const maxData = getMaxQualityData(player);

  showNotification(`${selected} selected (Max ${maxData?.qualityLabel || 'Unknown'})`, 3000);

  this.removeEventListener('playbackStart', notifyPlaybackQuality);
}

function setPlaybackQuality(this: PlayerManager, _: unknown) {
  if (this.playerMode === PlayerMode.PREVIEW && !isWatchContext()) return;

  console.debug('[video-quality] setting playback quality');
  this.removeEventListener('playbackStart', setPlaybackQuality);

  const prevQuality = this.player.getPlaybackQualityLabel();
  const maxData = getMaxQualityData(this.player);
  const maxQuality = maxData?.quality;

  const playerAny = this.player as unknown as {
    setPlaybackQuality?: (quality: string) => void;
    setPlaybackQualityRange: (min: string, max: string, formatId?: string) => void;
  };

  if (maxQuality) {
    playerAny.setPlaybackQualityRange(maxQuality, maxQuality);
    playerAny.setPlaybackQuality?.(maxQuality);
  } else {
    playerAny.setPlaybackQualityRange('highres', 'highres');
    playerAny.setPlaybackQuality?.('highres');
  }

  const targetQuality = maxQuality || 'highres';
  let attemptsLeft = 8;
  const enforceTimer = window.setInterval(() => {
    attemptsLeft -= 1;
    const currLabel = this.player.getPlaybackQualityLabel();
    const currQuality = (this.player as any).getPlaybackQuality?.();
    if (currLabel === maxData?.qualityLabel || currQuality === targetQuality || attemptsLeft <= 0) {
      clearInterval(enforceTimer);
      return;
    }

    playerAny.setPlaybackQualityRange(targetQuality, targetQuality);
    playerAny.setPlaybackQuality?.(targetQuality);
  }, 700);

  if (prevQuality === maxData?.qualityLabel) {
    notifyPlaybackQuality.call(this);
    return;
  }

  let timeoutToken: number | undefined;

  // No reliable event for quality change, so poll for it
  const intervalToken = window.setInterval(() => {
    const currQuality = this.player.getPlaybackQualityLabel();
    if (currQuality !== prevQuality) {
      notifyPlaybackQuality.call(this);
      clearInterval(intervalToken);
      clearTimeout(timeoutToken);
    }
  }, 100);

  timeoutToken = window.setTimeout(() => {
    console.warn('[video-quality] timed out waiting for quality change');
    clearInterval(intervalToken);
    notifyPlaybackQuality.call(this);
  }, 3000);
}

function handleNewVideo(this: PlayerManager, _: EventMap['newVideo']) {
  if (!shouldForce()) return;

  this.removeEventListener('playbackStart', setPlaybackQuality);
  this.addEventListener('playbackStart', setPlaybackQuality);
}

playerManager.addEventListener('newVideo', handleNewVideo);
