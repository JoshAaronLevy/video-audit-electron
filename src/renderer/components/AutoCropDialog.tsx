import type { ReactElement } from 'react';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { Message } from 'primereact/message';
import { ProgressBar } from 'primereact/progressbar';
import { Tag } from 'primereact/tag';
import type {
  AutoCropJobSnapshot,
  AutoCropResult,
  AutoCropResultItem
} from '../../shared/types/autoCrop';
import type { CropRectangle, VideoRow } from '../../shared/types/video';

interface AutoCropDialogProps {
  visible: boolean;
  selectedVideos: VideoRow[];
  outputRootDir: string | null;
  progress: AutoCropJobSnapshot | null;
  percent: number | null;
  result: AutoCropResult | null;
  error: string | null;
  isSubmitting: boolean;
  onSubmit: () => void;
  onCancel: () => void;
  onHide: () => void;
  onRevealOutputDir: (path: string) => void;
}

const MIN_VISIBLE_WIDTH = 640;
const MIN_VISIBLE_HEIGHT = 360;
const ASPECT_RATIO_16_9 = 16 / 9;
const AUTO_CROP_ASPECT_TOLERANCE = 0.03;

export function AutoCropDialog({
  visible,
  selectedVideos,
  outputRootDir,
  progress,
  percent,
  result,
  error,
  isSubmitting,
  onSubmit,
  onCancel,
  onHide,
  onRevealOutputDir
}: AutoCropDialogProps): ReactElement {
  const selectedCount = selectedVideos.length;
  const readiness = getReadinessSummary(selectedVideos);
  const skippedPreview = readiness.skipped.slice(0, 6);
  const activeOutputDir = result?.outputDir ?? progress?.outputDir ?? outputRootDir;
  const requestedCount = progress?.totalFiles ?? selectedCount;
  const resultProblemItems =
    result?.items
      .filter((item) => item.status === 'failed' || item.status === 'skipped')
      .slice(0, 8) ?? [];
  const canSubmit = selectedCount > 0 && Boolean(outputRootDir) && !isSubmitting;
  const footer = result ? (
    <div className="dialog-actions">
      {activeOutputDir ? (
        <Button
          label="Reveal Output"
          icon="pi pi-folder-open"
          severity="help"
          onClick={() => onRevealOutputDir(activeOutputDir)}
        />
      ) : null}
      <Button label="Close" icon="pi pi-check" severity="info" onClick={onHide} />
    </div>
  ) : isSubmitting ? (
    <div className="dialog-actions">
      <Button label="Cancel Auto-Crop" icon="pi pi-times" severity="danger" onClick={onCancel} />
    </div>
  ) : (
    <div className="dialog-actions">
      <Button label="Cancel" icon="pi pi-times" severity="secondary" outlined onClick={onHide} />
      <Button
        label="Crop Videos"
        icon="pi pi-crop"
        severity="success"
        disabled={!canSubmit}
        onClick={onSubmit}
      />
    </div>
  );

  return (
    <Dialog
      header={result ? 'Auto-Crop Complete' : 'Auto-Crop Selected Videos'}
      visible={visible}
      modal
      draggable={false}
      className="auto-crop-dialog"
      footer={footer}
      onHide={() => {
        if (!isSubmitting) {
          onHide();
        }
      }}
    >
      <div className="auto-crop-dialog-content">
        {!result && !isSubmitting ? (
          <>
            <div className="auto-crop-summary-grid">
              <SummaryMetric label="Selected" value={selectedCount.toLocaleString()} />
              <SummaryMetric label="Ready" value={readiness.ready.toLocaleString()} />
              <SummaryMetric label="Skipped" value={readiness.skipped.length.toLocaleString()} />
            </div>
            <div className="auto-crop-paths">
              <span>Output folder</span>
              <code>{activeOutputDir ?? 'Choose an output folder before running Auto-Crop.'}</code>
            </div>
            <Message
              severity="info"
              text="Eligible videos are copied to 1920x1080 cropped outputs. Source files are not modified."
            />
            {skippedPreview.length > 0 ? (
              <AutoCropItemList title="Skipped" items={skippedPreview} />
            ) : null}
          </>
        ) : null}

        {!result && isSubmitting ? (
          <div className="auto-crop-progress">
            <ProgressBar value={percent ?? 0} />
            <p>{progress?.message ?? 'Cropping videos...'}</p>
            <div className="auto-crop-progress-counts">
              <Tag value={`${(progress?.processedFiles ?? 0).toLocaleString()} / ${requestedCount.toLocaleString()}`} />
              <Tag value={`${(progress?.succeededCount ?? 0).toLocaleString()} cropped`} severity="success" />
              <Tag value={`${(progress?.skippedCount ?? 0).toLocaleString()} skipped`} severity="warning" />
              <Tag value={`${(progress?.errorCount ?? 0).toLocaleString()} failed`} severity="danger" />
            </div>
            <div className="auto-crop-current-grid">
              <SummaryMetric label="Current" value={progress?.currentFile || 'Preparing...'} />
              <SummaryMetric label="Output" value={progress?.outputDir ? 'Ready' : 'Preparing'} />
              <SummaryMetric label="Manifest" value="In progress" />
            </div>
            <div className="auto-crop-paths">
              <span>Output folder</span>
              <code>{activeOutputDir ?? 'Preparing output folder.'}</code>
            </div>
          </div>
        ) : null}

        {result ? (
          <>
            <Message
              severity={result.summary.failed > 0 ? 'warn' : 'success'}
              text="Auto-Crop finished. Source videos were not modified."
            />
            <div className="auto-crop-paths">
              <span>Output folder</span>
              <code>{result.outputDir}</code>
            </div>
            {result.manifestPath ? (
              <div className="auto-crop-paths">
                <span>Manifest</span>
                <code>{result.manifestPath}</code>
              </div>
            ) : null}
            <div className="auto-crop-summary-grid">
              <SummaryMetric label="Requested" value={result.summary.requested.toLocaleString()} />
              <SummaryMetric label="Eligible" value={result.summary.eligible.toLocaleString()} />
              <SummaryMetric label="Cropped" value={result.summary.succeeded.toLocaleString()} />
              <SummaryMetric label="Skipped" value={result.summary.skipped.toLocaleString()} />
              <SummaryMetric label="Failed" value={result.summary.failed.toLocaleString()} />
            </div>
            {resultProblemItems.length > 0 ? (
              <AutoCropResultList title="Skipped / Failed" items={resultProblemItems} />
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

function AutoCropItemList({
  title,
  items
}: {
  title: string;
  items: Array<{ fileName: string; reason: string }>;
}): ReactElement {
  return (
    <div className="auto-crop-item-list">
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={`${item.fileName}-${item.reason}`}>
            <strong>{item.fileName}</strong>
            <small>{item.reason}</small>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AutoCropResultList({
  title,
  items
}: {
  title: string;
  items: AutoCropResultItem[];
}): ReactElement {
  return (
    <div className="auto-crop-item-list">
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={`${item.sourcePath}-${item.status}-${item.error ?? 'item'}`}>
            <strong>{item.fileName}</strong>
            <small>{item.error ?? item.status}</small>
          </li>
        ))}
      </ul>
    </div>
  );
}

function getReadinessSummary(videos: VideoRow[]): {
  ready: number;
  skipped: Array<{ fileName: string; reason: string }>;
} {
  const skipped: Array<{ fileName: string; reason: string }> = [];
  let ready = 0;

  for (const video of videos) {
    const reason = getAutoCropSkipReason(video);

    if (reason) {
      skipped.push({
        fileName: video.displayFile || video.fileName || 'Video',
        reason
      });
    } else {
      ready += 1;
    }
  }

  return { ready, skipped };
}

function getAutoCropSkipReason(video: VideoRow): string | null {
  const blackBorder = video.adjustments?.blackBorder;
  const visibleArea = blackBorder?.visibleArea;

  if (!blackBorder?.analyzed) {
    return 'Black-border analysis has not run.';
  }

  if (blackBorder.classification === 'analysis_error') {
    return 'Black-border analysis errored.';
  }

  if (blackBorder.classification !== 'nested_borders') {
    return 'Not a high-confidence nested-border result.';
  }

  if (blackBorder.confidence !== 'high') {
    return 'Confidence is not high.';
  }

  if (blackBorder.recommendedFix?.eligible !== true || blackBorder.recommendedFix.type !== 'crop-scale') {
    return 'Not eligible for crop-scale.';
  }

  const crop = normalizeCrop(visibleArea);

  if (!crop) {
    return 'Missing usable crop rectangle.';
  }

  if (crop.width < MIN_VISIBLE_WIDTH || crop.height < MIN_VISIBLE_HEIGHT) {
    return 'Visible area is too small.';
  }

  if (Math.abs(crop.width / crop.height - ASPECT_RATIO_16_9) > AUTO_CROP_ASPECT_TOLERANCE) {
    return 'Visible area is not close to 16:9.';
  }

  const sourceWidth = readFiniteNumber(blackBorder.source?.width) ?? readFiniteNumber(video.width);
  const sourceHeight = readFiniteNumber(blackBorder.source?.height) ?? readFiniteNumber(video.height);

  if (
    sourceWidth !== null &&
    sourceHeight !== null &&
    (crop.x + crop.width > sourceWidth || crop.y + crop.height > sourceHeight)
  ) {
    return 'Crop rectangle is outside the source dimensions.';
  }

  return null;
}

function normalizeCrop(visibleArea: CropRectangle | undefined): Pick<CropRectangle, 'width' | 'height' | 'x' | 'y'> | null {
  if (!visibleArea) {
    return null;
  }

  const width = readFiniteNumber(visibleArea.width);
  const height = readFiniteNumber(visibleArea.height);
  const x = readFiniteNumber(visibleArea.x);
  const y = readFiniteNumber(visibleArea.y);

  if (
    width === null ||
    height === null ||
    x === null ||
    y === null ||
    width <= 0 ||
    height <= 0 ||
    x < 0 ||
    y < 0
  ) {
    return null;
  }

  return {
    width: Math.round(width),
    height: Math.round(height),
    x: Math.round(x),
    y: Math.round(y)
  };
}

function readFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}
