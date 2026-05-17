import type { ToolDiagnosticItem, ToolDiagnosticsResult } from '../../shared/types/diagnostics';
import { runChildProcess } from '../utils/childProcess';
import { getSettings } from './settingsService';

export async function checkMediaToolAvailability(): Promise<ToolDiagnosticsResult> {
  const settings = await getSettings();
  const tools = await Promise.all([
    checkTool('ffmpeg', settings.ffmpegPathOverride?.trim() || 'ffmpeg'),
    checkTool('ffprobe', settings.ffprobePathOverride?.trim() || 'ffprobe')
  ]);

  const failedCount = tools.filter((tool) => !tool.ok).length;

  return {
    status: 'complete',
    checkedAt: new Date().toISOString(),
    tools,
    message:
      failedCount === 0
        ? 'ffmpeg and ffprobe are available.'
        : `${failedCount.toLocaleString()} media tool(s) could not be reached.`
  };
}

async function checkTool(
  name: ToolDiagnosticItem['name'],
  command: string
): Promise<ToolDiagnosticItem> {
  const result = await runChildProcess(command, ['-version']);
  const versionLine = getFirstLine(result.stdout || result.stderr);

  if (!result.ok) {
    return {
      name,
      command,
      ok: false,
      versionLine,
      message: result.error || `${name} could not be reached.`
    };
  }

  return {
    name,
    command,
    ok: true,
    versionLine,
    message: `${name} is available.`
  };
}

function getFirstLine(value: string): string | null {
  const line = value.split(/\r?\n/).map((entry) => entry.trim()).find(Boolean);
  return line ?? null;
}
