import { BrowserWindow, Menu, app, shell, type MenuItemConstructorOptions } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants/ipcChannels';
import type { AppCommand } from '../../shared/types/appCommands';
import { getSettings } from './settingsService';

export async function installAppMenu(): Promise<void> {
  Menu.setApplicationMenu(Menu.buildFromTemplate(await buildMenuTemplate()));
}

export async function refreshAppMenu(): Promise<void> {
  await installAppMenu();
}

async function buildMenuTemplate(): Promise<MenuItemConstructorOptions[]> {
  const settings = await getSettings();
  const recentFolderItems = settings.recentFolders.slice(0, 10).map((folderPath) => ({
    label: folderPath,
    click: (): void => {
      sendCommand('choose-folder');
    }
  }));

  return [
    {
      label: app.name,
      submenu: [
        {
          label: 'Settings...',
          accelerator: 'CmdOrCtrl+,',
          click: (): void => sendCommand('open-settings')
        },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'File',
      submenu: [
        {
          label: 'Choose Folder...',
          accelerator: 'CmdOrCtrl+O',
          click: (): void => sendCommand('choose-folder')
        },
        {
          label: 'Choose Files...',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: (): void => sendCommand('choose-files')
        },
        {
          label: 'Refresh Latest Audit',
          accelerator: 'CmdOrCtrl+R',
          click: (): void => sendCommand('refresh-audit')
        },
        { type: 'separator' },
        {
          label: 'Recent Folders',
          enabled: recentFolderItems.length > 0,
          submenu:
            recentFolderItems.length > 0
              ? recentFolderItems
              : [
                  {
                    label: 'No recent folders',
                    enabled: false
                  }
                ]
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' }
      ]
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'Open FFmpeg Website',
          click: (): void => {
            void shell.openExternal('https://ffmpeg.org/');
          }
        }
      ]
    }
  ];
}

function sendCommand(command: AppCommand): void {
  const window = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null;

  if (!window || window.isDestroyed()) {
    return;
  }

  window.webContents.send(IPC_CHANNELS.appCommand, command);
}
