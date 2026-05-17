import { app, BrowserWindow } from 'electron';
import { join } from 'node:path';
import { registerIpcHandlers } from './ipc/registerIpcHandlers';
import {
  registerMediaPreviewProtocolHandler,
  registerMediaPreviewProtocolScheme
} from './services/mediaPreviewProtocol';
import { installAppMenu } from './services/appMenuService';
import { getInitialWindowOptions, trackWindowState } from './services/windowStateService';

const isDev = Boolean(process.env.ELECTRON_RENDERER_URL);

registerMediaPreviewProtocolScheme();

async function createMainWindow(): Promise<void> {
  const windowOptions = await getInitialWindowOptions();
  const mainWindow = new BrowserWindow({
    width: windowOptions.width,
    height: windowOptions.height,
    x: windowOptions.x,
    y: windowOptions.y,
    minWidth: 920,
    minHeight: 620,
    title: 'Video Audit',
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
