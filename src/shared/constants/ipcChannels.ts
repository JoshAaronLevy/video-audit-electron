export const IPC_CHANNELS = {
  appGetInfo: 'app:get-info',
  dialogChooseFolders: 'dialog:choose-folders',
  dialogChooseVideoFiles: 'dialog:choose-video-files',
  dialogChooseOutputFolder: 'dialog:choose-output-folder',
  shellRevealPath: 'shell:reveal-path',
  settingsGet: 'settings:get',
  settingsUpdate: 'settings:update',
  settingsReset: 'settings:reset',
  auditDiscoveryStart: 'audit:discovery:start',
  auditDiscoveryCancel: 'audit:discovery:cancel',
  auditDiscoveryProgress: 'audit:discovery:progress'
} as const;
