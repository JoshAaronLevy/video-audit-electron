import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { app, BrowserWindow } from 'electron';
import { registerIpcHandlers } from './ipc/registerIpcHandlers';
import {
  registerMediaPreviewProtocolHandler,
  registerMediaPreviewProtocolScheme
} from './services/mediaPreviewProtocol';
import { installAppMenu } from './services/appMenuService';
import { getInitialWindowOptions, trackWindowState } from './services/windowStateService';

const isDev = Boolean(process.env.ELECTRON_RENDERER_URL);

registerMediaPreviewProtocolScheme();

function getRuntimeIconPath(): string | undefined {
  const iconCandidates = app.isPackaged
    ? [
        join(process.resourcesPath, 'icon.png'),
        join(process.resourcesPath, 'assets', 'icon.png'),
        join(app.getAppPath(), 'assets', 'icon.png')
      ]
    : [join(app.getAppPath(), 'assets', 'icon.png'), join(process.cwd(), 'assets', 'icon.png')];

  return iconCandidates.find((iconPath) => existsSync(iconPath));
}

async function createMainWindow(): Promise<void> {
  const windowOptions = await getInitialWindowOptions();
  const appIconPath = getRuntimeIconPath();
  const mainWindow = new BrowserWindow({
    width: windowOptions.width,
    height: windowOptions.height,
    x: windowOptions.x,
    y: windowOptions.y,
    minWidth: 920,
    minHeight: 620,
    title: 'Video Audit',
    ...(appIconPath ? { icon: appIconPath } : {}),
    backgroundColor: '#f8fafc',
    webPreferences: {
      preload: join(__dirname, '../preload/preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  trackWindowState(mainWindow);

  if (windowOptions.shouldMaximize) {
    mainWindow.maximize();
  }

  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
    return;
  }

  void mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
}

app.whenReady().then(() => {
  const appIconPath = getRuntimeIconPath();
  if (process.platform === 'darwin' && appIconPath) {
    app.dock?.setIcon(appIconPath);
  }

  registerMediaPreviewProtocolHandler();
  registerIpcHandlers();
  void installAppMenu();
  void createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
