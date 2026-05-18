import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { Message } from 'primereact/message';
import { Tag } from 'primereact/tag';
import type { MoveOperationPlan, TrashOperationPlan } from '../../shared/types/fileOperations';
import { DialogFooter, DialogHeader } from './DialogChrome';

type ConfirmableFileOperationPlan = MoveOperationPlan | TrashOperationPlan;
type ConfirmButtonSeverity = 'secondary' | 'success' | 'info' | 'warning' | 'danger' | 'help' | 'contrast';

interface FileOperationConfirmDialogProps {
  visible: boolean;
  plan: ConfirmableFileOperationPlan | null;
  title: string;
  description: string;
  confirmLabel: string;
  confirmIcon: string;
  confirmSeverity?: ConfirmButtonSeverity;
  error: string | null;
  isSubmitting: boolean;
  onConfirm: (typedConfirmation: string | null) => void;
  onHide: () => void;
}

export function FileOperationConfirmDialog({
  visible,
  plan,
  title,
  description,
  confirmLabel,
  confirmIcon,
  confirmSeverity = 'success',
  error,
  isSubmitting,
  onConfirm,
  onHide
}: FileOperationConfirmDialogProps): ReactElement {
  const [typedConfirmation, setTypedConfirmation] = useState('');
  const executableCount = plan ? plan.summary.ready + plan.summary.warning : 0;
  const confirmation = plan && 'confirmation' in plan ? plan.confirmation : null;
  const typedConfirmationMatches = confirmation ? typedConfirmation === confirmation.phrase : true;
  const canConfirm = Boolean(plan && executableCount > 0 && (!confirmation?.isRequired || typedConfirmationMatches));
  const attentionItems = useMemo(
    () => plan?.items.filter((item) => item.status !== 'ready').slice(0, 6) ?? [],
    [plan]
  );

  useEffect(() => {
    if (visible) {
      setTypedConfirmation('');
    }
  }, [visible, plan?.id]);

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
        <DialogFooter
          left={plan ? `${executableCount.toLocaleString()} file(s) eligible` : undefined}
        >
          <Button label="Cancel" icon="pi pi-times" severity="secondary" outlined onClick={onHide} />
          <Button
            label={confirmLabel}
            icon={confirmIcon}
            severity={confirmSeverity}
            loading={isSubmitting}
            disabled={!canConfirm}
            onClick={() => onConfirm(confirmation?.isRequired ? typedConfirmation : null)}
          />
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
        {plan ? (
          <>
            <section className="file-operation-summary-grid" aria-label={`${title} plan summary`}>
              <Metric label="Selected" value={plan.summary.total.toLocaleString()} />
              <Metric label="Ready" value={plan.summary.ready.toLocaleString()} />
              <Metric label="Warnings" value={plan.summary.warning.toLocaleString()} />
              <Metric label="Blocked" value={plan.summary.blocked.toLocaleString()} />
              <Metric label="Size" value={formatBytes(plan.summary.totalSizeBytes)} />
            </section>

            {plan.type === 'move' ? (
              <section className="file-operation-path-panel" aria-label="Move destination">
                <span>Destination</span>
                <code title={plan.destinationDirectory}>{plan.destinationDirectory}</code>
                <span>Conflicts</span>
                <strong>{getConflictStrategyLabel(plan.conflictStrategy)}</strong>
              </section>
            ) : null}

            {confirmation?.reasons.length ? (
              <Message
                severity="warn"
                text={`Extra confirmation required: ${confirmation.reasons.join(' ')}`}
              />
            ) : null}

            {confirmation?.isRequired ? (
              <label className="typed-confirmation-row">
                <span>Type {confirmation.phrase} to confirm</span>
                <InputText
                  value={typedConfirmation}
                  placeholder={confirmation.phrase}
                  onChange={(event) => setTypedConfirmation(event.target.value)}
                />
              </label>
            ) : null}

            {attentionItems.length > 0 ? (
              <section className="file-operation-attention-list" aria-label="Items needing attention">
                <h3>Needs Attention</h3>
                <ul>
                  {attentionItems.map((item) => (
                    <li key={item.id}>
                      <div>
                        <strong title={item.sourcePath}>{item.fileName}</strong>
                        <Tag value={item.status} severity={item.status === 'warning' ? 'warning' : 'danger'} />
                      </div>
                      <small>{[...item.warnings, ...item.errors].join(' ')}</small>
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

function getConflictStrategyLabel(strategy: MoveOperationPlan['conflictStrategy']): string {
  return strategy === 'rename-with-suffix' ? 'Rename with suffix' : 'Block existing files';
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
