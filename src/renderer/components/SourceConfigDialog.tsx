import type { ReactElement } from 'react';
import { Button } from 'primereact/button';
import { Checkbox } from 'primereact/checkbox';
import { Dialog } from 'primereact/dialog';
import { Message } from 'primereact/message';
import { Tag } from 'primereact/tag';
import type { AuditOptions } from '../../shared/types/audit';
import type { SelectedFolderSummary } from '../../shared/types/folderTree';
import { formatBytes } from '../helpers/fileSize';
import { DialogFooter, DialogHeader } from './DialogChrome';

interface SourceConfigDialogProps {
  visible: boolean;
  selectedFolders: string[];
  selectedFolderSummary: SelectedFolderSummary | null;
  selectedFiles: string[];
  outputFolder: string | null;
  recentFolders: string[];
  auditOptions: AuditOptions;
  isAuditActive: boolean;
  canRunAudit: boolean;
  activeAction: string | null;
  selectionMessage: string | null;
  workflowMessage: string | null;
  onChooseFolders: () => void;
  onChooseFiles: () => void;
  onChooseOutputFolder: () => void;
  onChooseRecentFolder: (path: string) => void;
  onClearSelectedSources: () => void;
  onRunAudit: () => void | Promise<void>;
  onCancelAudit: () => void;
  onRevealPath: (path: string) => void;
  onAuditOptionChange: <Key extends keyof AuditOptions>(key: Key, value: AuditOptions[Key]) => void;
  onHide: () => void;
}

export function SourceConfigDialog({
  visible,
  selectedFolders,
  selectedFolderSummary,
  selectedFiles,
  outputFolder,
  recentFolders,
  auditOptions,
  isAuditActive,
  canRunAudit,
  activeAction,
  selectionMessage,
  workflowMessage,
  onChooseFolders,
  onChooseFiles,
  onChooseOutputFolder,
  onChooseRecentFolder,
  onClearSelectedSources,
  onRunAudit,
  onCancelAudit,
  onRevealPath,
  onAuditOptionChange,
  onHide
}: SourceConfigDialogProps): ReactElement {
  const sourceCount = selectedFolders.length + selectedFiles.length;
  const folderTreeSummary = selectedFolderSummary
    ? formatFolderTreeSummary(selectedFolderSummary, auditOptions.includeSubfolders)
    : null;
  const footer = (
    <DialogFooter
      left={
        <Button
          label="Clear Sources"
          icon="pi pi-times"
          severity="danger"
          outlined
          disabled={sourceCount === 0 || isAuditActive}
          onClick={onClearSelectedSources}
        />
      }
    >
      <Button label="Cancel" icon="pi pi-ban" severity="secondary" outlined onClick={onHide} />
      <Button label="Apply" icon="pi pi-check" severity="info" outlined onClick={onHide} />
      {isAuditActive ? (
        <Button
          label="Cancel Audit"
          icon="pi pi-times"
          severity="danger"
          onClick={onCancelAudit}
        />
      ) : (
        <Button
          label="Run Audit"
          icon="pi pi-verified"
          severity="success"
          disabled={!canRunAudit}
          onClick={() => {
            void onRunAudit();
          }}
        />
      )}
    </DialogFooter>
  );

  return (
    <Dialog
      header={
        <DialogHeader
          eyebrow="Sources"
          title="Configure Sources"
          description="Choose audit inputs, output location, and scan options."
        />
      }
      visible={visible}
      className="app-dialog source-config-dialog"
      modal
      draggable={false}
      footer={footer}
      onHide={onHide}
    >
      <div className="source-config-content">
        <section className="source-config-hero" aria-label="Selected source summary">
          <div>
            <p className="eyebrow">Audit input</p>
            <h2>
              {sourceCount > 0
                ? formatSourceSummary(selectedFolders.length, selectedFiles.length)
                : 'No sources selected'}
            </h2>
            <span title={outputFolder ?? undefined}>
              Output: {outputFolder ? shortenMiddle(outputFolder) : 'Not set'}
            </span>
            {folderTreeSummary ? <span>{folderTreeSummary}</span> : null}
          </div>
          <div className="source-config-counts">
            <Tag
              value={`${selectedFolders.length.toLocaleString()} folders`}
              severity={selectedFolders.length > 0 ? 'success' : 'secondary'}
            />
            <Tag
              value={`${selectedFiles.length.toLocaleString()} files`}
              severity={selectedFiles.length > 0 ? 'success' : 'secondary'}
            />
            <Tag
              value={outputFolder ? 'Output set' : 'No output'}
              severity={outputFolder ? 'success' : 'secondary'}
            />
          </div>
        </section>

        <section className="source-config-picker-grid" aria-label="Source selection actions">
          <PickerAction
            title="Folders"
            detail={
              folderTreeSummary ??
              (selectedFolders.length > 0
                ? `${selectedFolders.length.toLocaleString()} selected`
                : 'Choose one or more folders.')
            }
            buttonLabel="Choose Folders"
            icon="pi pi-folder-open"
            loading={activeAction === 'folders'}
            disabled={isAuditActive}
            onClick={onChooseFolders}
          />
          <PickerAction
            title="Files"
            detail={
              selectedFiles.length > 0
                ? `${selectedFiles.length.toLocaleString()} selected`
                : 'Choose individual video files.'
            }
            buttonLabel="Choose Files"
            icon="pi pi-video"
            severity="secondary"
            loading={activeAction === 'files'}
            disabled={isAuditActive}
            onClick={onChooseFiles}
          />
          <PickerAction
            title="Output"
            detail={outputFolder ? shortenMiddle(outputFolder) : 'Optional output folder.'}
            buttonLabel="Choose Output"
            icon="pi pi-download"
            severity="help"
            loading={activeAction === 'output'}
            disabled={isAuditActive}
            onClick={onChooseOutputFolder}
          />
        </section>

        {recentFolders.length > 0 ? (
          <section className="source-config-recent" aria-label="Recent folders">
            <div className="compact-heading">
              <h3>Recent folders</h3>
              <Tag value={String(recentFolders.length)} severity="info" />
            </div>
            <div className="source-config-recent-list">
              {recentFolders.slice(0, 5).map((path) => (
                <Button
                  key={path}
                  label={shortenMiddle(path)}
                  title={path}
                  icon="pi pi-history"
                  severity="secondary"
                  disabled={isAuditActive}
                  onClick={() => onChooseRecentFolder(path)}
                />
              ))}
            </div>
          </section>
        ) : null}

        <section className="source-config-options" aria-label="Audit options">
          <div className="compact-heading">
            <h3>Audit options</h3>
            <Tag
              value={
                auditOptions.includeLowResolutionAnalysis || auditOptions.includeBlackBorderAnalysis
                  ? 'Ready'
                  : 'Choose one'
              }
              severity={
                auditOptions.includeLowResolutionAnalysis || auditOptions.includeBlackBorderAnalysis
                  ? 'success'
                  : 'warning'
              }
            />
          </div>
          <div className="audit-options">
            <AuditOption
              inputId="source-config-include-subfolders"
              label="Include subfolders"
              checked={auditOptions.includeSubfolders}
              disabled={isAuditActive}
              onChange={(checked) => onAuditOptionChange('includeSubfolders', checked)}
            />
            <AuditOption
              inputId="source-config-low-resolution"
              label="Low-resolution scan"
              checked={auditOptions.includeLowResolutionAnalysis}
              disabled={isAuditActive}
              onChange={(checked) => onAuditOptionChange('includeLowResolutionAnalysis', checked)}
            />
            <AuditOption
              inputId="source-config-black-border"
              label="Black-border analysis"
              checked={auditOptions.includeBlackBorderAnalysis}
              disabled={isAuditActive}
              onChange={(checked) => onAuditOptionChange('includeBlackBorderAnalysis', checked)}
            />
          </div>
        </section>

        <section className="source-config-paths" aria-label="Selected paths">
          <PathSummary
            title="Folders"
            emptyLabel="No folders selected"
            paths={selectedFolders}
            revealDisabled={activeAction === 'reveal'}
            onRevealPath={onRevealPath}
          />
          <PathSummary
            title="Files"
            emptyLabel="No files selected"
            paths={selectedFiles}
            revealDisabled={activeAction === 'reveal'}
            onRevealPath={onRevealPath}
          />
          <PathSummary
            title="Output"
            emptyLabel="No output folder"
            paths={outputFolder ? [outputFolder] : []}
            revealDisabled={activeAction === 'reveal'}
            onRevealPath={onRevealPath}
          />
        </section>

        {selectionMessage ? <Message severity="warn" text={selectionMessage} /> : null}
        {workflowMessage ? <Message severity="info" text={workflowMessage} /> : null}
      </div>
    </Dialog>
  );
}

function PickerAction({
  title,
  detail,
  buttonLabel,
  icon,
  severity,
  loading,
  disabled,
  onClick
}: {
  title: string;
  detail: string;
  buttonLabel: string;
  icon: string;
  severity?: 'success' | 'secondary' | 'info' | 'warning' | 'danger' | 'help' | 'contrast';
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}): ReactElement {
  return (
    <div className="source-config-picker">
      <span>{title}</span>
      <strong title={detail}>{detail}</strong>
      <Button
        label={buttonLabel}
        icon={icon}
        severity={severity}
        loading={loading}
        disabled={disabled}
        onClick={onClick}
      />
    </div>
  );
}

function AuditOption({
  inputId,
  label,
  checked,
  disabled,
  onChange
}: {
  inputId: string;
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}): ReactElement {
  return (
    <label className="audit-option" htmlFor={inputId}>
      <Checkbox
        inputId={inputId}
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(Boolean(event.checked))}
      />
      <span>{label}</span>
    </label>
  );
}

function PathSummary({
  title,
  emptyLabel,
  paths,
  revealDisabled,
  onRevealPath
}: {
  title: string;
  emptyLabel: string;
  paths: string[];
  revealDisabled: boolean;
  onRevealPath: (path: string) => void;
}): ReactElement {
  const previewPaths = paths.slice(0, 4);
  const hiddenCount = Math.max(paths.length - previewPaths.length, 0);

  return (
    <section className="source-config-path-card" aria-label={title}>
      <div className="compact-heading">
        <h3>{title}</h3>
        <Tag value={String(paths.length)} severity={paths.length > 0 ? 'success' : 'secondary'} />
      </div>
      {previewPaths.length > 0 ? (
        <ul className="source-config-path-list">
          {previewPaths.map((path) => (
            <li key={path}>
              <span title={path}>{shortenMiddle(path)}</span>
              <Button
                aria-label={`Reveal ${path} in Finder`}
                icon="pi pi-external-link"
                severity="secondary"
                disabled={revealDisabled}
                onClick={() => onRevealPath(path)}
              />
            </li>
          ))}
          {hiddenCount > 0 ? (
            <li className="source-config-more-paths">
              <span>{hiddenCount.toLocaleString()} more selected</span>
            </li>
          ) : null}
        </ul>
      ) : (
        <p className="empty-copy">{emptyLabel}</p>
      )}
    </section>
  );
}

function formatSourceSummary(folderCount: number, fileCount: number): string {
  const folderLabel = folderCount === 1 ? 'folder' : 'folders';
  const fileLabel = fileCount === 1 ? 'file' : 'files';
  return `${folderCount.toLocaleString()} ${folderLabel} - ${fileCount.toLocaleString()} ${fileLabel}`;
}

function formatFolderTreeSummary(
  summary: SelectedFolderSummary,
  includeSubfolders: boolean
): string {
  const videoCount = includeSubfolders ? summary.totalVideoCount : summary.directVideoCount;
  const sizeBytes = includeSubfolders
    ? summary.totalVideoSizeBytes
    : summary.directVideoSizeBytes;
  const videoLabel = includeSubfolders ? 'recursive videos' : 'direct videos';

  return `${summary.dedupedFolderCount.toLocaleString()} folder tree sources - ${videoCount.toLocaleString()} ${videoLabel} - ${formatBytes(sizeBytes)}`;
}

function shortenMiddle(path: string): string {
  const parts = path.split('/').filter(Boolean);

  if (parts.length <= 3) {
    return path;
  }

  return `/${parts[0]}/.../${parts.at(-2) ?? ''}/${parts.at(-1) ?? ''}`;
}
