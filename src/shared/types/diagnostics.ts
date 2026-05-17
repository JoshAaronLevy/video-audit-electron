export interface ToolDiagnosticItem {
  name: 'ffmpeg' | 'ffprobe';
  command: string;
  ok: boolean;
  versionLine: string | null;
  message: string;
}

export interface ToolDiagnosticsResult {
  status: 'complete' | 'error' | string;
  checkedAt: string;
  tools: ToolDiagnosticItem[];
  message?: string;
}
