import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { Message } from 'primereact/message';
import { Tag } from 'primereact/tag';
import type {
  DuplicateScanCandidate,
  DuplicateScanGroup,
  DuplicateScanResult
} from '../../shared/types/duplicateScan';
import type { FileOperationPlanItem, TrashOperationPlan } from '../../shared/types/fileOperations';
import { formatBytes } from '../helpers/fileSize';
import { DialogFooter, DialogHeader } from './DialogChrome';

interface DuplicateTrashConfirmDialogProps {
  visible: boolean;
  result: DuplicateScanResult | null;
  markedCandidateIds: string[];
  plan: TrashOperationPlan | null;
  error: string | null;
  isSubmitting: boolean;
  onConfirm: (typedConfirmation: string | null) => void;
  onHide: () => void;
}

type TagSeverity = 'success' | 'info' | 'warning' | 'danger' | 'secondary';

interface CandidateReviewItem {
  candidate: DuplicateScanCandidate;
  planItem: FileOperationPlanItem | null;
}

interface SourceReviewGroup {
  group: DuplicateScanGroup;
  candidates: CandidateReviewItem[];
}

export function DuplicateTrashConfirmDialog({
  visible,
  result,
  markedCandidateIds,
  plan,
  error,
  isSubmitting,
  onConfirm,
  onHide
}: DuplicateTrashConfirmDialogProps): ReactElement {
  const [typedConfirmation, setTypedConfirmation] = useState('');
  const reviewGroups = useMemo(
    () => getReviewGroups(result, markedCandidateIds, plan),
    [markedCandidateIds, plan, result]
  );
  const attentionItems = useMemo(
    () => plan?.items.filter((item) => item.status !== 'ready') ?? [],
    [plan]
  );
  const executableCount = plan ? plan.summary.ready + plan.summary.warning : 0;
  const confirmation = plan?.confirmation ?? null;
  const typedConfirmationMatches = confirmation ? typedConfirmation === confirmation.phrase : true;
  const canConfirm = Boolean(plan && executableCount > 0 && (!confirmation?.isRequired || typedConfirmationMatches));

  useEffect(() => {
    if (visible) {
      setTypedConfirmation('');
    }
  }, [visible, plan?.id]);

  return (
    <Dialog
      header={
        <DialogHeader
          eyebrow="Duplicate Review"
          title="Move Marked Files to Trash"
          description="Review protected project sources and marked duplicate candidates before anything is moved."
        />
      }
      footer={
        <DialogFooter left={plan ? `${executableCount.toLocaleString()} file(s) eligible` : undefined}>
          <Button
            label="Cancel"
            icon="pi pi-times"
            severity="secondary"
            outlined
            disabled={isSubmitting}
            onClick={onHide}
          />
          <Button
            label="Move Marked Files to Trash"
            icon="pi pi-trash"
            severity="danger"
            loading={isSubmitting}
            disabled={!canConfirm}
            onClick={() => onConfirm(confirmation?.isRequired ? typedConfirmation : null)}
          />
        </DialogFooter>
      }
      visible={visible}
      modal
      draggable={false}
      className="app-dialog duplicate-trash-dialog"
      onHide={() => {
        if (!isSubmitting) {
          onHide();
        }
      }}
    >
      <div className="duplicate-trash-content">
        {error ? <Message severity="error" text={error} /> : null}

        {plan && result ? (
          <>
            <Message
              severity="warn"
              text="Project source files are protected and will be kept. Only marked duplicate candidates are eligible to move to macOS Trash after immediate revalidation."
            />

            <section className="duplicate-trash-summary-grid" aria-label="Duplicate Trash plan summary">
              <Metric label="Marked files" value={plan.summary.total.toLocaleString()} />
              <Metric label="Ready" value={plan.summary.ready.toLocaleString()} />
              <Metric label="Warnings" value={plan.summary.warning.toLocaleString()} />
              <Metric label="Blocked" value={plan.summary.blocked.toLocaleString()} />
              <Metric label="Total size" value={formatBytes(plan.summary.totalSizeBytes)} />
            </section>

            <section className="duplicate-trash-path-panel" aria-label="Duplicate scan folder">
              <span>Scanned folder</span>
              <code title={result.scannedFolder}>{result.scannedFolder}</code>
            </section>

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
                  disabled={isSubmitting}
                  onChange={(event) => setTypedConfirmation(event.target.value)}
                />
              </label>
            ) : null}

            <section className="duplicate-trash-group-list" aria-label="Grouped duplicate Trash review">
              {reviewGroups.map((reviewGroup) => (
                <article key={reviewGroup.group.id} className="duplicate-trash-source-group">
                  <div className="duplicate-trash-source-heading">
                    <div>
                      <Tag value="Project Source" severity="success" />
                      <Tag value="Kept" severity="secondary" />
                    </div>
                    <strong title={reviewGroup.group.source.path}>{reviewGroup.group.source.fileName}</strong>
                    <code title={reviewGroup.group.source.path}>{reviewGroup.group.source.path}</code>
                  </div>

                  <ul className="duplicate-trash-candidate-list">
                    {reviewGroup.candidates.map(({ candidate, planItem }) => (
                      <li key={candidate.id}>
                        <div>
                          <strong title={candidate.path}>{candidate.fileName}</strong>
                          <Tag
                            value={planItem ? formatPlanStatus(planItem.status) : 'Not planned'}
                            severity={planItem ? getPlanStatusSeverity(planItem.status) : 'danger'}
                          />
                        </div>
                        <code title={candidate.path}>{candidate.path}</code>
                        <small>
                          {formatBytes(candidate.sizeBytes)}
                          {' - '}
                          {planItem ? formatPlanItemNotes(planItem) : 'Candidate was not included in the Trash plan.'}
                        </small>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </section>

            {attentionItems.length > 0 ? (
              <section className="duplicate-trash-attention-list" aria-label="Duplicate Trash plan items needing attention">
                <h3>Needs Attention</h3>
                <ul>
                  {attentionItems.slice(0, 8).map((item) => (
                    <li key={item.id}>
                      <div>
                        <strong title={item.sourcePath}>{item.fileName}</strong>
                        <Tag value={formatPlanStatus(item.status)} severity={getPlanStatusSeverity(item.status)} />
                      </div>
                      <small>{formatPlanItemNotes(item)}</small>
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

function getReviewGroups(
  result: DuplicateScanResult | null,
  markedCandidateIds: string[],
  plan: TrashOperationPlan | null
): SourceReviewGroup[] {
  if (!result) {
    return [];
  }

  const markedIds = new Set(markedCandidateIds);
  const planItemsByPath = new Map((plan?.items ?? []).map((item) => [item.sourcePath, item]));

  return result.groups
    .map((group): SourceReviewGroup | null => {
      const candidates = group.candidates
        .filter((candidate) => markedIds.has(candidate.id) || markedIds.has(candidate.path))
        .map((candidate) => ({
          candidate,
          planItem: planItemsByPath.get(candidate.path) ?? null
        }));

      if (candidates.length === 0) {
        return null;
      }

      return {
        group,
        candidates
      };
    })
    .filter((group): group is SourceReviewGroup => group !== null);
}

function formatPlanStatus(status: FileOperationPlanItem['status']): string {
  switch (status) {
    case 'ready':
      return 'Ready';
    case 'warning':
      return 'Warning';
    case 'blocked':
      return 'Blocked';
    case 'missing-source':
      return 'Missing';
    case 'missing-output':
      return 'Missing output';
    case 'destination-conflict':
      return 'Destination conflict';
    case 'invalid-path':
      return 'Invalid path';
    case 'unsupported-file':
      return 'Unsupported file';
    case 'would-overwrite':
      return 'Would overwrite';
  }
}

function getPlanStatusSeverity(status: FileOperationPlanItem['status']): TagSeverity {
  switch (status) {
    case 'ready':
      return 'success';
    case 'warning':
      return 'warning';
    default:
      return 'danger';
  }
}

function formatPlanItemNotes(item: FileOperationPlanItem): string {
  const notes = [...item.warnings, ...item.errors].filter((note) => note.trim() !== '');

  if (notes.length === 0) {
    return item.status === 'ready'
      ? 'Will be revalidated immediately before moving to Trash.'
      : 'Review this item before continuing.';
  }

  return notes.join(' ');
}
