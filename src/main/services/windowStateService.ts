import type { BrowserWindowConstructorOptions, BrowserWindow } from 'electron';
import type { AppWindowState } from '../../shared/types/settings';
import { getSettings, updateSettings } from './settingsService';

const DEFAULT_WINDOW_STATE: Required<Pick<AppWindowState, 'width' | 'height'>> &
  Pick<AppWindowState, 'x' | 'y' | 'isMaximized'> = {
  width: 1180,
  height: 760,
  x: null,
  y: null,
  isMaximized: false
};

export async function getInitialWindowOptions(): Promise<Pick<
  BrowserWindowConstructorOptions,
  'width' | 'height' | 'x' | 'y'
> & { shouldMaximize: boolean }> {
  const state = (await getSettings()).windowState ?? DEFAULT_WINDOW_STATE;

  return {
    width: state.width,
    height: state.height,
    x: state.x ?? undefined,
    y: state.y ?? undefined,
    shouldMaximize: state.isMaximized
  };
}

export function trackWindowState(window: BrowserWindow): void {
  const persist = (): void => {
    void persistWindowState(window);
  };

  window.on('close', persist);
}

async function persistWindowState(window: BrowserWindow): Promise<void> {
  if (window.isDestroyed()) {
    return;
  }

  const bounds = window.getBounds();

  await updateSettings({
    windowState: {
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      isMaximized: window.isMaximized()
    }
  });
}
