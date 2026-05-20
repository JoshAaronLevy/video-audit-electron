export function startDuplicateScan(
  request: Parameters<typeof window.videoAudit.duplicateScan.start>[0]
) {
  return window.videoAudit.duplicateScan.start(request);
}

export function cancelDuplicateScan(jobId: string) {
  return window.videoAudit.duplicateScan.cancel(jobId);
}

export function getDuplicateScanResult(jobId: string) {
  return window.videoAudit.duplicateScan.getResult(jobId);
}

export function createDuplicateScanTrashPlan(
  request: Parameters<typeof window.videoAudit.duplicateScan.createTrashPlan>[0]
) {
  return window.videoAudit.duplicateScan.createTrashPlan(request);
}

export function subscribeToDuplicateScanProgress(
  callback: Parameters<typeof window.videoAudit.duplicateScan.onProgress>[0]
) {
  return window.videoAudit.duplicateScan.onProgress(callback);
}
