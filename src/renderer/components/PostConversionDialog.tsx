import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { Message } from 'primereact/message';
import { ProgressBar } from 'primereact/progressbar';
import { Tag } from 'primereact/tag';
import type {
  ReplacementAction,
  ReplacementExecutionJobSnapshot,
  ReplacementPlan,
  ReplacementPlanBulkAction,
  ReplacementPlanItem
} from '../../shared/types/replacementWorkflow';
import { DialogFooter, DialogHeader } from './DialogChrome';
import { ReplacementPlanSummary } from './ReplacementPlanSummary';
import { ReplacementReviewTable } from './ReplacementReviewTable';

const REPLACE_CONFIRMATION = 'REPLACE';
const TEN_GB_BYTES = 10 * 1024 * 1024 * 1024;

export type PostConversionDialogMode = 'choices' | 'manual-review';

interface PostConversionDialogProps {
  visible: boolean;
  sourceLabel: string | null;
  plan: ReplacementPlan | null;
  mode: PostConversionDialogMode;
  error: string | null;
  message: string | null;
  isPlanning: boolean;
  isUpdatingActions: boolean;
  isExecuting: boolean;
  progress: ReplacementExecutionJobSnapshot | null;
  percent: number | null;
  onPlanActionChange: (itemId: string, selectedAction: ReplacementAction) => void;
  onPlanBulkAction: (action: ReplacementPlanBulkAction) => void;
  onReplaceOriginals: (typedConfirmation: string | null) => void;
  onCancelExecution: () => void;
  onReviewManually: () => void;
  onLeaveOutputs: () => void;
  onBackToChoices: () => void;
  onHide: () => void;
}

export function PostConversionDialog({
  visible,
  sourceLabel,
  plan,
  mode,
  error,
  message,
  isPlanning,
  isUpdatingActions,
  isExecuting,
  progress,
  percent,
  onPlanActionChange,
  onPlanBulkAction,
  onReplaceOriginals,
  onCancelExecution,
  onReviewManually,
  onLeaveOutputs,
  onBackToChoices,
  onHide
}: PostConversionDialogProps): ReactElement {
  const [typedConfirmation, setTypedConfirmation] = useState('');
  const highRiskReasons = useMemo(() => (plan ? getHighRiskReasons(plan) : []), [plan]);
  const requiresConfirmation = highRiskReasons.length > 0;
  const executableCount = plan?.items.filter(isExecutableReplacementItem).length ?? 0;
  const isBusy = isPlanning || isUpdatingActions || isExecuting;
  const canReplace = Boolean(
    plan &&
      executableCount > 0 &&
      !isBusy &&
      (!requiresConfirmation || typedConfirmation === REPLACE_CONFIRMATION)
  );

  useEffect(() => {
    if (visible) {
      setTypedConfirmation('');
    }
  }, [visible, plan?.id, mode]);

  return (
    <Dialog
      header={
        <DialogHeader
          eyebrow={sourceLabel ? `${sourceLabel} Complete` : 'Conversion Complete'}
          title={mode === 'manual-review' ? 'Review Replacement Plan' : 'Conversion Complete'}
          description={
            mode === 'manual-review'
              ? 'Review source files, converted outputs, proposed final paths, and blocked items.'
              : 'What do you want to do with the converted videos?'
          }
        />
      }
      footer={
        isExecuting ? (
          <DialogFooter>
            <Button
              label="Cancel Replacement"
              icon="pi pi-times"
              severity="danger"
              onClick={onCancelExecution}
            />
          </DialogFooter>
        ) : (
          <DialogFooter>
            {mode === 'manual-review' ? (
              <Button label="Back" icon="pi pi-arrow-left" severity="secondary" outlined onClick={onBackToChoices} />
            ) : null}
            <Button
              label="Leave Files Where They Are"
              icon="pi pi-check"
              severity="secondary"
              outlined
              disabled={isBusy}
              onClick={onLeaveOutputs}
            />
            {mode === 'choices' ? (
              <Button
                label="Review Manually"
                icon="pi pi-list-check"
                severity="info"
                outlined
                disabled={!plan || isBusy}
                onClick={onReviewManually}
              />
            ) : null}
            <Button
              label={mode === 'manual-review' ? 'Execute Selected Actions' : 'Replace Originals'}
              icon="pi pi-sync"
              severity="danger"
              disabled={!canReplace}
              loading={isExecuting}
              onClick={() => onReplaceOriginals(requiresConfirmation ? typedConfirmation : null)}
            />
          </DialogFooter>
        )
      }
      visible={visible}
      modal
      draggable={false}
      className="app-dialog post-conversion-dialog"
      onHide={() => {
        if (!isBusy) {
          onHide();
        }
      }}
    >
      <div className="post-conversion-content">
        {isPlanning ? <Message severity="info" text="Preparing replacement plan..." /> : null}
        {isExecuting ? (
          <section className="replacement-progress" aria-label="Replacement progress">
            <ProgressBar value={percent ?? 0} />
            <p>{progress?.message ?? 'Replacing originals with converted files...'}</p>
            <div className="replacement-progress-counts">
              <Tag
                value={`${(progress?.processedItems ?? 0).toLocaleString()} / ${(progress?.totalItems ?? executableCount).toLocaleString()}`}
              />
              <Tag value={`${(progress?.succeededCount ?? 0).toLocaleString()} replaced`} severity="success" />
              <Tag value={`${(progress?.skippedCount ?? 0).toLocaleString()} skipped`} severity="warning" />
              <Tag value={`${(progress?.failedCount ?? 0).toLocaleString()} failed`} severity="danger" />
            </div>
            <div className="replacement-summary-grid">
              <div>
                <span>Current</span>
                <strong title={progress?.currentFile ?? 'Preparing'}>
                  {progress?.currentFile ?? 'Preparing'}
                </strong>
              </div>
              <div>
                <span>Phase</span>
                <strong>{progress?.phase ?? 'pending'}</strong>
              </div>
            </div>
          </section>
        ) : null}
        {error ? <Message severity="error" text={error} /> : null}
        {message ? <Message severity="info" text={message} /> : null}

        {plan ? (
          <>
            <ReplacementPlanSummary plan={plan} />

            {highRiskReasons.length > 0 ? (
              <section className="typed-confirmation-row">
                <span>Type {REPLACE_CONFIRMATION} to confirm</span>
                <InputText
                  value={typedConfirmation}
                  placeholder={REPLACE_CONFIRMATION}
                  onChange={(event) => setTypedConfirmation(event.target.value)}
                />
                <small>{highRiskReasons.join(' ')}</small>
              </section>
            ) : null}

            {mode === 'choices' ? (
              <>
                <section className="post-conversion-option-grid" aria-label="Post-conversion actions">
                  <button
                    type="button"
                    className="post-conversion-option"
                    disabled={isBusy}
                    onClick={onReviewManually}
                  >
                    <span>Review manually</span>
                    <strong>{plan.summary.warning + plan.summary.blocked > 0 ? 'Recommended' : 'Inspect plan'}</strong>
                    <small>Open the itemized plan before deciding what to replace.</small>
                  </button>
                  <button
                    type="button"
                    className="post-conversion-option"
                    disabled={isBusy}
                    onClick={onLeaveOutputs}
                  >
                    <span>Leave files where they are</span>
                    <strong>No file changes</strong>
                    <small>Keep converted videos in the output folder.</small>
                  </button>
                </section>

                <Message
                  severity={plan.summary.blocked > 0 ? 'warn' : 'info'}
                  text="Replace originals with converted files moves original files to macOS Trash, then moves converted files into the original source folders."
                />
              </>
            ) : (
              <ReplacementReviewTable
                plan={plan}
                isBusy={isBusy}
                canExecute={canReplace}
                onActionChange={onPlanActionChange}
                onBulkAction={onPlanBulkAction}
                onExecute={() => onReplaceOriginals(requiresConfirmation ? typedConfirmation : null)}
              />
            )}
          </>
        ) : null}
      </div>
    </Dialog>
  );
}

function isExecutableReplacementItem(item: ReplacementPlanItem): boolean {
  return (
    item.selectedAction === 'replace-original' &&
    (item.status === 'ready' || item.status === 'warning')
  );
}

function getHighRiskReasons(plan: ReplacementPlan): string[] {
  const reasons: string[] = [];
  const executableItems = plan.items.filter(isExecutableReplacementItem);

  if (executableItems.length > 10) {
    reasons.push('More than 10 files are ready to replace.');
  }

  if (executableItems.reduce((total, item) => total + (item.originalSizeBytes ?? 0), 0) > TEN_GB_BYTES) {
    reasons.push('Original files total more than 10 GB.');
  }

  if (executableItems.some((item) => item.warnings.length > 0)) {
    reasons.push('One or more replacement items has warnings.');
  }

  if (plan.summary.destinationConflicts > 0) {
    reasons.push('One or more destination conflicts was detected.');
  }

  if (executableItems.some((item) => isExternalPath(item.originalPath) || isExternalPath(item.outputPath))) {
    reasons.push('One or more paths appears to be on an external volume.');
  }

  if (executableItems.some((item) => item.warningCodes.includes('extension-changed'))) {
    reasons.push('One or more converted extensions differs from the original.');
  }

  return reasons;
}

function isExternalPath(path: string): boolean {
  return path.startsWith('/Volumes/');
}
