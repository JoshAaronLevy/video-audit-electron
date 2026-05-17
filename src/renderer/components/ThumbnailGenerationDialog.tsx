import type { ReactElement } from 'react';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { Message } from 'primereact/message';
import { ProgressBar } from 'primereact/progressbar';
import { RadioButton } from 'primereact/radiobutton';
import { Tag } from 'primereact/tag';
import type {
  MediaPreviewJobSnapshot,
  MediaPreviewResult,
  MediaPreviewScope
} from '../../shared/types/mediaPreview';

interface ThumbnailGenerationDialogProps {
  visible: boolean;
  allCount: number;
  selectedCount: number;
  scope: MediaPreviewScope;
  progress: MediaPreviewJobSnapshot | null;
  percent: number | null;
  result: MediaPreviewResult | null;
  error: string | null;
  isSubmitting: boolean;
  onScopeChange: (scope: MediaPreviewScope) => void;
  onSubmit: () => void;
  onCancel: () => void;
  onHide: () => void;
}

export function ThumbnailGenerationDialog({
  visible,
  allCount,
  selectedCount,
  scope,
  progress,
  percent,
  result,
  error,
  isSubmitting,
  onScopeChange,
  onSubmit,
  onCancel,
  onHide
}: ThumbnailGenerationDialogProps): ReactElement {
  const hasSelection = selectedCount > 0;
  const requestedCount = scope === 'selected' && hasSelection ? selectedCount : allCount;
  const failedItems =
    result?.items
      .filter((item) => item.thumbnail.generated !== true)
      .slice(0, 6) ?? [];
  const footer = result ? (
    <div className="dialog-actions">
      <Button label="Close" icon="pi pi-check" severity="info" onClick={onHide} />
    </div>
  ) : isSubmitting ? (
    <div className="dialog-actions">
      <Button label="Cancel Generation" icon="pi pi-times" severity="danger" onClick={onCancel} />
    </div>
  ) : (
    <div className="dialog-actions">
      <Button label="Cancel" icon="pi pi-times" severity="secondary" outlined onClick={onHide} />
      <Button
        label={hasSelection ? 'Generate' : 'Generate for All'}
        icon="pi pi-images"
        severity="success"
        disabled={requestedCount === 0}
        onClick={onSubmit}
      />
    </div>
  );

  return (
    <Dialog
      header={result ? 'Thumbnail Generation Complete' : 'Generate Thumbnails'}
      visible={visible}
      modal
      draggable={false}
      className="thumbnail-dialog"
      footer={footer}
      onHide={() => {
        if (!isSubmitting) {
          onHide();
        }
      }}
    >
      <div className="thumbnail-dialog-content">
        {!result && !isSubmitting ? (
          <>
            {hasSelection ? (
              <div className="thumbnail-scope-options">
                <label className="thumbnail-scope-option" htmlFor="thumbnail-scope-selected">
                  <RadioButton
                    inputId="thumbnail-scope-selected"
                    name="thumbnailScope"
                    value="selected"
                    checked={scope === 'selected'}
                    onChange={() => onScopeChange('selected')}
                  />
                  <span>
                    <strong>Selected videos only</strong>
                    <small>{selectedCount.toLocaleString()}</small>
                  </span>
                </label>
                <label className="thumbnail-scope-option" htmlFor="thumbnail-scope-all">
                  <RadioButton
                    inputId="thumbnail-scope-all"
                    name="thumbnailScope"
                    value="all"
                    checked={scope === 'all'}
                    onChange={() => onScopeChange('all')}
                  />
                  <span>
                    <strong>All videos in table</strong>
                    <small>{allCount.toLocaleString()}</small>
                  </span>
                </label>
              </div>
            ) : (
              <Message
                severity="info"
                text={`Generate thumbnails for all ${allCount.toLocaleString()} videos in the table.`}
              />
            )}
            <Message
              severity="info"
              text="Thumbnails are cached by source path, size, and modified time so future preview clips can reuse the same media-preview records."
            />
          </>
        ) : null}

        {!result && isSubmitting ? (
          <div className="thumbnail-progress">
            <ProgressBar value={percent ?? 0} />
            <p>{progress?.message ?? 'Generating thumbnails...'}</p>
            <div className="thumbnail-progress-counts">
              <Tag value={`${(progress?.processedVideos ?? 0).toLocaleString()} / ${requestedCount.toLocaleString()}`} />
              <Tag value={`${(progress?.generatedCount ?? 0).toLocaleString()} generated`} severity="success" />
              <Tag value={`${(progress?.cachedCount ?? 0).toLocaleString()} cached`} severity="info" />
              <Tag value={`${(progress?.failedCount ?? 0).toLocaleString()} failed`} severity="danger" />
            </div>
            <div className="thumbnail-current-file">
              <span>Current</span>
              <strong>{progress?.currentFile || 'Preparing...'}</strong>
            </div>
          </div>
        ) : null}

        {result ? (
          <>
            <Message
              severity={result.summary.failed > 0 ? 'warn' : 'success'}
              text="Thumbnail metadata has been merged into the table."
            />
            <div className="thumbnail-summary-grid">
              <SummaryMetric label="Requested" value={result.summary.requested.toLocaleString()} />
              <SummaryMetric label="Generated" value={result.summary.generated.toLocaleString()} />
              <SummaryMetric label="Cached" value={result.summary.cached.toLocaleString()} />
              <SummaryMetric label="Failed" value={result.summary.failed.toLocaleString()} />
            </div>
            {failedItems.length > 0 ? (
              <div className="thumbnail-failed-items">
                <h3>Failed Items</h3>
                <ul>
                  {failedItems.map((item) => (
                    <li key={`${item.path ?? item.fileName}-${item.thumbnail.error ?? 'failed'}`}>
                      <strong>{item.fileName || item.path}</strong>
                      <small>{item.thumbnail.error ?? 'Thumbnail generation failed.'}</small>
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
