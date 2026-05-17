import type { ReactElement } from 'react';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { Message } from 'primereact/message';
import { ProgressBar } from 'primereact/progressbar';
import { Tag } from 'primereact/tag';
import type {
  AutoFixAction,
  AutoFixJobSnapshot,
  AutoFixProfileId,
  AutoFixResult
} from '../../shared/types/autoFix';

interface AutoFixDialogProps {
  visible: boolean;
  selectedCount: number;
  outputDirectory: string | null;
  progress: AutoFixJobSnapshot | null;
  percent: number | null;
  result: AutoFixResult | null;
  error: string | null;
  isSubmitting: boolean;
  onSubmit: () => void;
  onCancel: () => void;
  onHide: () => void;
  onRevealOutputDirectory: (path: string) => void;
}

export function AutoFixDialog({
  visible,
  selectedCount,
  outputDirectory,
  progress,
  percent,
  result,
  error,
  isSubmitting,
  onSubmit,
  onCancel,
  onHide,
  onRevealOutputDirectory
}: AutoFixDialogProps): ReactElement {
  const activeOutputDirectory = result?.outputDirectory ?? progress?.outputDirectory ?? outputDirectory;
  const failedItems = result?.items.filter((item) => item.status === 'failed').slice(0, 6) ?? [];
  const requestedCount = progress?.totalVideos ?? selectedCount;
  const canSubmit = selectedCount > 0 && Boolean(outputDirectory) && !isSubmitting;
  const footer = result ? (
    <div className="dialog-actions">
      {activeOutputDirectory ? (
        <Button
          label="Reveal Output"
          icon="pi pi-folder-open"
          severity="help"
          onClick={() => onRevealOutputDirectory(activeOutputDirectory)}
        />
      ) : null}
      <Button label="Close" icon="pi pi-check" severity="info" onClick={onHide} />
    </div>
  ) : isSubmitting ? (
    <div className="dialog-actions">
      <Button label="Cancel Auto-Fix" icon="pi pi-times" severity="danger" onClick={onCancel} />
    </div>
  ) : (
    <div className="dialog-actions">
      <Button label="Cancel" icon="pi pi-times" severity="secondary" outlined onClick={onHide} />
      <Button
        label="Fix Videos"
        icon="pi pi-wrench"
        severity="success"
        disabled={!canSubmit}
        onClick={onSubmit}
      />
    </div>
  );

  return (
    <Dialog
      header={result ? 'Auto-Fix Complete' : 'Auto-Fix Selected Videos'}
      visible={visible}
      modal
      draggable={false}
      className="auto-fix-dialog"
      footer={footer}
      onHide={() => {
        if (!isSubmitting) {
          onHide();
        }
      }}
    >
      <div className="auto-fix-dialog-content">
        {!result && !isSubmitting ? (
          <>
            <div className="auto-fix-summary-grid">
              <SummaryMetric label="Selected" value={selectedCount.toLocaleString()} />
              <SummaryMetric label="Output" value={activeOutputDirectory ? 'Ready' : 'Missing'} />
            </div>
            <div className="auto-fix-paths">
              <span>Output folder</span>
              <code>{activeOutputDirectory ?? 'Choose an output folder before running Auto-Fix.'}</code>
            </div>
            <Message
              severity="info"
              text="Auto-Fix normalizes selected videos to 1920x1080 with FFmpeg. Source files are never overwritten."
            />
            <Message
              severity="warn"
              text="Existing output files are preserved by creating a new safe filename when needed."
            />
          </>
        ) : null}

        {!result && isSubmitting ? (
          <div className="auto-fix-progress">
            <ProgressBar value={percent ?? 0} />
            <p>{progress?.message ?? 'Auto-fixing videos...'}</p>
            <div className="auto-fix-progress-counts">
              <Tag value={`${(progress?.processedVideos ?? 0).toLocaleString()} / ${requestedCount.toLocaleString()}`} />
              <Tag value={`${(progress?.succeeded ?? 0).toLocaleString()} succeeded`} severity="success" />
              <Tag value={`${(progress?.failed ?? 0).toLocaleString()} failed`} severity="danger" />
            </div>
            <div className="auto-fix-current-grid">
              <SummaryMetric label="Current" value={progress?.currentFile || 'Preparing...'} />
              <SummaryMetric label="Profile" value={getProfileLabel(progress?.currentProfile ?? null)} />
              <SummaryMetric label="Action" value={getActionLabel(progress?.currentAction ?? null)} />
            </div>
            <div className="auto-fix-paths">
              <span>Output folder</span>
              <code>{activeOutputDirectory ?? 'Preparing output folder.'}</code>
            </div>
          </div>
        ) : null}

        {result ? (
          <>
            <Message
              severity={result.summary.failed > 0 ? 'warn' : 'success'}
              text="Auto-Fix finished. Source videos were not modified."
            />
            <div className="auto-fix-paths">
              <span>Output folder</span>
              <code>{result.outputDirectory}</code>
            </div>
            <div className="auto-fix-summary-grid">
              <SummaryMetric label="Requested" value={result.summary.requested.toLocaleString()} />
              <SummaryMetric label="Succeeded" value={result.summary.succeeded.toLocaleString()} />
              <SummaryMetric label="Failed" value={result.summary.failed.toLocaleString()} />
              <SummaryMetric
                label="Standard"
                value={result.summary.standardProfileCount.toLocaleString()}
              />
              <SummaryMetric
                label="High quality"
                value={result.summary.highQualityProfileCount.toLocaleString()}
              />
              <SummaryMetric label="Crop + normalize" value={result.summary.croppedCount.toLocaleString()} />
              <SummaryMetric
                label="Normalize"
                value={result.summary.normalizedOnlyCount.toLocaleString()}
              />
            </div>
            {failedItems.length > 0 ? (
              <div className="auto-fix-failed-items">
                <h3>Failed</h3>
                <ul>
                  {failedItems.map((item) => (
                    <li key={`${item.sourcePath ?? item.fileName}-${item.error ?? 'failed'}`}>
                      <strong>{item.fileName}</strong>
                      <small>{item.error ?? 'Auto-Fix failed.'}</small>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        ) : null}

        {error ? <Message severity="error" text={error} /> : null}
      </div>
    </Dialog>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div>
      <span>{label}</span>
      <strong title={value}>{value}</strong>
    </div>
  );
}

function getProfileLabel(profile: AutoFixProfileId | null): string {
  if (profile === 'standard') {
    return 'Standard';
  }

  if (profile === 'high-quality') {
    return 'High quality';
  }

  return 'Pending';
}

function getActionLabel(action: AutoFixAction | null): string {
  if (action === 'crop-normalize') {
    return 'Crop + normalize';
  }

  if (action === 'normalize') {
    return 'Normalize';
  }

  return 'Pending';
}
