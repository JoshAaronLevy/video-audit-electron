import type { ReactElement } from 'react';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { Message } from 'primereact/message';
import { Tag } from 'primereact/tag';
import type { FileOperationResult } from '../../shared/types/fileOperations';
import { DialogFooter, DialogHeader } from './DialogChrome';

interface FileOperationResultDialogProps {
  visible: boolean;
  result: FileOperationResult | null;
  title: string;
  description: string;
  error: string | null;
  onHide: () => void;
}

export function FileOperationResultDialog({
  visible,
  result,
  title,
  description,
  error,
  onHide
}: FileOperationResultDialogProps): ReactElement {
  const attentionItems =
    result?.items.filter((item) => item.status === 'failed' || item.status === 'skipped') ?? [];

  return (
    <Dialog
      header={
        <DialogHeader
          eyebrow="File Management"
          title={title}
          description={description}
        />
      }
      footer={
        <DialogFooter>
          <Button label="Close" icon="pi pi-check" onClick={onHide} />
        </DialogFooter>
      }
      visible={visible}
      modal
      draggable={false}
      className="app-dialog file-operation-dialog"
      onHide={onHide}
    >
      <div className="file-operation-content">
        {error ? <Message severity="error" text={error} /> : null}
        {result ? (
          <>
            <section className="file-operation-summary-grid" aria-label={`${title} summary`}>
              <Metric label={getSuccessMetricLabel(result.type)} value={result.summary.succeeded.toLocaleString()} />
              <Metric label="Skipped" value={result.summary.skipped.toLocaleString()} />
              <Metric label="Failed" value={result.summary.failed.toLocaleString()} />
              <Metric label="Size" value={formatBytes(result.summary.totalSizeBytes)} />
              <Metric label="Status" value={getStatusLabel(result.status)} />
            </section>

            {result.summary.succeeded > 0 ? (
              <Message
                severity="success"
                text={getSuccessMessage(result)}
              />
            ) : null}

            {attentionItems.length > 0 ? (
              <section className="file-operation-attention-list" aria-label="Items needing attention">
                <h3>Needs Attention</h3>
                <ul>
                  {attentionItems.map((item) => (
                    <li key={item.id}>
                      <div>
                        <strong title={item.sourcePath}>{item.fileName}</strong>
                        <Tag value={item.status} severity={item.status === 'failed' ? 'danger' : 'warning'} />
                      </div>
                      <small>{item.error ?? getAttentionFallback(result.type)}</small>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        ) : null}
      </div>
    </Dialog>
  );
}

function Metric({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function getStatusLabel(status: FileOperationResult['status']): string {
  return status === 'complete-with-failures' ? 'Partial' : status;
}

function getSuccessMetricLabel(type: FileOperationResult['type']): string {
  return type === 'trash' ? 'Trashed' : 'Moved';
}

function getSuccessMessage(result: FileOperationResult): string {
  if (result.type === 'trash') {
    return `${result.summary.succeeded.toLocaleString()} file(s) moved to Trash.`;
  }

  return `${result.summary.succeeded.toLocaleString()} file(s) moved.`;
}

function getAttentionFallback(type: FileOperationResult['type']): string {
  return type === 'trash' ? 'Item was not moved to Trash.' : 'Item was not moved.';
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) {
    return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  }

  if (bytes >= 1024 ** 2) {
    return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  }

  return `${bytes.toLocaleString()} B`;
}
