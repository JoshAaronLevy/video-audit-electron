import type { ReactElement } from 'react';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { Message } from 'primereact/message';
import { Tag } from 'primereact/tag';
import type { FileOperationResult } from '../../shared/types/fileOperations';
import { formatBytes } from '../helpers/fileSize';
import { DialogFooter, DialogHeader } from './DialogChrome';

interface DuplicateTrashResultDialogProps {
  visible: boolean;
  result: FileOperationResult | null;
  error: string | null;
  onHide: () => void;
}

export function DuplicateTrashResultDialog({
  visible,
  result,
  error,
  onHide
}: DuplicateTrashResultDialogProps): ReactElement {
  const attentionItems =
    result?.items.filter((item) => item.status === 'failed' || item.status === 'skipped') ?? [];
  const warningItems =
    result?.items.filter((item) => item.status === 'success' && item.warnings.length > 0) ?? [];

  return (
    <Dialog
      header={
        <DialogHeader
          eyebrow="Duplicate Review"
          title="Move Marked Files to Trash Result"
          description="Review which duplicate candidates moved to macOS Trash and which need attention."
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
      className="app-dialog duplicate-trash-result-dialog"
      onHide={onHide}
    >
      <div className="duplicate-trash-result-content">
        {error ? <Message severity="error" text={error} /> : null}

        {result ? (
          <>
            <section className="duplicate-trash-summary-grid" aria-label="Duplicate Trash result summary">
              <Metric label="Moved to Trash" value={result.summary.succeeded.toLocaleString()} />
              <Metric label="Skipped" value={result.summary.skipped.toLocaleString()} />
              <Metric label="Failed" value={result.summary.failed.toLocaleString()} />
              <Metric label="Size" value={formatBytes(result.summary.totalSizeBytes)} />
              <Metric label="Status" value={formatResultStatus(result.status)} />
            </section>

            {result.summary.succeeded > 0 ? (
              <Message
                severity="success"
                text={`${result.summary.succeeded.toLocaleString()} duplicate candidate file(s) moved to Trash.`}
              />
            ) : null}

            {attentionItems.length > 0 ? (
              <section className="duplicate-trash-attention-list" aria-label="Duplicate Trash result attention items">
                <h3>Skipped or Failed</h3>
                <ul>
                  {attentionItems.map((item) => (
                    <li key={item.id}>
                      <div>
                        <strong title={item.sourcePath}>{item.fileName}</strong>
                        <Tag value={item.status} severity={item.status === 'failed' ? 'danger' : 'warning'} />
                      </div>
                      <small>{item.error ?? 'Item was not moved to Trash.'}</small>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {warningItems.length > 0 ? (
              <section className="duplicate-trash-attention-list" aria-label="Duplicate Trash warnings">
                <h3>Moved With Warnings</h3>
                <ul>
                  {warningItems.slice(0, 8).map((item) => (
                    <li key={item.id}>
                      <div>
                        <strong title={item.sourcePath}>{item.fileName}</strong>
                        <Tag value="warning" severity="warning" />
                      </div>
                      <small>{item.warnings.join(' ')}</small>
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
      <strong title={value}>{value}</strong>
    </div>
  );
}

function formatResultStatus(status: FileOperationResult['status']): string {
  return status === 'complete-with-failures' ? 'Partial' : status;
}
