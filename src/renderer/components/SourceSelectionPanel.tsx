import type { ReactElement } from 'react';
import { Button } from 'primereact/button';
import { Card } from 'primereact/card';
import { Checkbox } from 'primereact/checkbox';
import { Message } from 'primereact/message';
import { Tag } from 'primereact/tag';
import type { AuditOptions } from '../../shared/types/audit';

interface SourceSelectionPanelProps {
  selectedFolders: string[];
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
  onRunAudit: () => void;
  onCancelAudit: () => void;
  onRevealPath: (path: string) => void;
  onAuditOptionChange: <Key extends keyof AuditOptions>(key: Key, value: AuditOptions[Key]) => void;
}

export function SourceSelectionPanel({
  selectedFolders,
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
  onRunAudit,
  onCancelAudit,
  onRevealPath,
  onAuditOptionChange
}: SourceSelectionPanelProps): ReactElement {
  return (
    <Card className="workspace-card source-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Sources</p>
          <h2>Run audit</h2>
        </div>
        <Tag value={`${selectedFolders.length + selectedFiles.length} selected`} severity="info" />
      </div>

      <div className="action-row">
        <Button
          label="Choose Folder"
          icon="pi pi-folder-open"
          loading={activeAction === 'folders'}
          disabled={isAuditActive}
          onClick={onChooseFolders}
        />
        <Button
          label="Choose Files"
          icon="pi pi-video"
          severity="secondary"
          loading={activeAction === 'files'}
          disabled={isAuditActive}
          onClick={onChooseFiles}
        />
        <Button
          label="Output Folder"
          icon="pi pi-download"
          severity="help"
          loading={activeAction === 'output'}
          disabled={isAuditActive}
          onClick={onChooseOutputFolder}
        />
        {outputFolder ? (
          <Button
            label="Reveal Output"
            icon="pi pi-external-link"
            severity="help"
            outlined
            loading={activeAction === 'reveal'}
            disabled={isAuditActive}
            onClick={() => onRevealPath(outputFolder)}
          />
        ) : null}
      </div>

      {recentFolders.length > 0 ? (
        <div className="recent-folder-strip" aria-label="Recent folders">
          <span>Recent</span>
          {recentFolders.slice(0, 4).map((path) => (
            <Button
              key={path}
              label={shortenPath(path)}
              title={path}
              icon="pi pi-history"
              severity="secondary"
              text
              disabled={isAuditActive}
              onClick={() => onChooseRecentFolder(path)}
            />
          ))}
        </div>
      ) : null}

      <div className="audit-options" aria-label="Audit options">
        <AuditOption
          inputId="include-subfolders"
          label="Include subfolders"
          checked={auditOptions.includeSubfolders}
          disabled={isAuditActive}
          onChange={(checked) => onAuditOptionChange('includeSubfolders', checked)}
        />
        <AuditOption
          inputId="include-low-resolution-analysis"
          label="Low-resolution scan"
          checked={auditOptions.includeLowResolutionAnalysis}
          disabled={isAuditActive}
          onChange={(checked) => onAuditOptionChange('includeLowResolutionAnalysis', checked)}
        />
        <AuditOption
          inputId="include-black-border-analysis"
          label="Black-border analysis"
          checked={auditOptions.includeBlackBorderAnalysis}
          disabled={isAuditActive}
          onChange={(checked) => onAuditOptionChange('includeBlackBorderAnalysis', checked)}
        />
      </div>

      <div className="action-row">
        <Button
          label="Run Audit"
          icon="pi pi-verified"
          severity="success"
          loading={isAuditActive}
          disabled={!canRunAudit}
          onClick={onRunAudit}
        />
        <Button
          label="Cancel Audit"
          icon="pi pi-times"
          severity="danger"
          outlined
          disabled={!isAuditActive}
          onClick={onCancelAudit}
        />
      </div>

      {selectionMessage ? <Message severity="warn" text={selectionMessage} /> : null}
      {workflowMessage ? <Message severity="info" text={workflowMessage} /> : null}

      <div className="source-lists">
        <PathList
          title="Folders"
          emptyLabel="No folders selected"
          paths={selectedFolders}
          onRevealPath={onRevealPath}
          revealDisabled={activeAction === 'reveal'}
        />
        <PathList
          title="Files"
          emptyLabel="No files selected"
          paths={selectedFiles}
          onRevealPath={onRevealPath}
          revealDisabled={activeAction === 'reveal'}
        />
        <PathList
          title="Output"
          emptyLabel="No output folder"
          paths={outputFolder ? [outputFolder] : []}
          onRevealPath={onRevealPath}
          revealDisabled={activeAction === 'reveal'}
        />
      </div>
    </Card>
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

function PathList({
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
  return (
    <section className="path-list-panel" aria-label={title}>
      <div className="compact-heading">
        <h3>{title}</h3>
        <Tag value={String(paths.length)} severity={paths.length > 0 ? 'success' : 'secondary'} />
      </div>
      {paths.length > 0 ? (
        <ul className="compact-path-list">
          {paths.map((path) => (
            <li key={path}>
              <span title={path}>{path}</span>
              <Button
                aria-label={`Reveal ${path} in Finder`}
                icon="pi pi-external-link"
                severity="secondary"
                text
                rounded
                disabled={revealDisabled}
                onClick={() => onRevealPath(path)}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-copy">{emptyLabel}</p>
      )}
    </section>
  );
}

function shortenPath(path: string): string {
  const parts = path.split('/').filter(Boolean);

  if (parts.length <= 2) {
    return path;
  }

  return `${parts.at(-2)}/${parts.at(-1)}`;
}
