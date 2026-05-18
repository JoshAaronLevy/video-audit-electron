import type { ReactElement } from 'react';
import { Button } from 'primereact/button';
import { Tag } from 'primereact/tag';
import type { AuditOptions } from '../../shared/types/audit';

interface SourceSummaryBarProps {
  selectedFolders: string[];
  selectedFiles: string[];
  outputFolder: string | null;
  auditOptions: AuditOptions;
  isAuditActive: boolean;
  canRunAudit: boolean;
  activeAction: string | null;
  onChooseFolders: () => void;
  onChooseFiles: () => void;
  onChooseOutputFolder: () => void;
  onRunAudit: () => void;
  onCancelAudit: () => void;
  onOpenSourceSetup: () => void;
}

export function SourceSummaryBar({
  selectedFolders,
  selectedFiles,
  outputFolder,
  auditOptions,
  isAuditActive,
  canRunAudit,
  activeAction,
  onChooseFolders,
  onChooseFiles,
  onChooseOutputFolder,
  onRunAudit,
  onCancelAudit,
  onOpenSourceSetup
}: SourceSummaryBarProps): ReactElement {
  const sourceCount = selectedFolders.length + selectedFiles.length;

  return (
    <section className="source-summary-bar" aria-label="Audit sources">
      <div className="source-summary-copy">
        <p className="eyebrow">Sources</p>
        <h2>
          {sourceCount > 0
            ? formatSourceSummary(selectedFolders.length, selectedFiles.length)
            : 'Choose sources to begin'}
        </h2>
        <span title={outputFolder ?? undefined}>
          Output: {outputFolder ? shortenPath(outputFolder) : 'Not set'}
        </span>
      </div>

      <div className="source-option-strip" aria-label="Audit options">
        <Tag value={auditOptions.includeSubfolders ? 'Subfolders on' : 'Subfolders off'} />
        <Tag value={auditOptions.includeLowResolutionAnalysis ? 'Low-res on' : 'Low-res off'} />
        <Tag value={auditOptions.includeBlackBorderAnalysis ? 'Borders on' : 'Borders off'} />
      </div>

      <div className="source-summary-actions">
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
          label="Output"
          icon="pi pi-download"
          severity="help"
          loading={activeAction === 'output'}
          disabled={isAuditActive}
          onClick={onChooseOutputFolder}
        />
        <Button
          label="Configure"
          icon="pi pi-sliders-h"
          severity="info"
          onClick={onOpenSourceSetup}
        />
        <Button
          label="Run Audit"
          icon="pi pi-verified"
          severity="success"
          loading={isAuditActive}
          disabled={!canRunAudit}
          onClick={onRunAudit}
        />
        {isAuditActive ? (
          <Button label="Cancel" icon="pi pi-times" severity="danger" onClick={onCancelAudit} />
        ) : null}
      </div>
    </section>
  );
}

function formatSourceSummary(folderCount: number, fileCount: number): string {
  const folderLabel = folderCount === 1 ? 'folder' : 'folders';
  const fileLabel = fileCount === 1 ? 'file' : 'files';
  return `${folderCount.toLocaleString()} ${folderLabel} - ${fileCount.toLocaleString()} ${fileLabel}`;
}

function shortenPath(path: string): string {
  const parts = path.split('/').filter(Boolean);

  if (parts.length <= 3) {
    return path;
  }

  return `/${parts[0]}/.../${parts.at(-1) ?? ''}`;
}
