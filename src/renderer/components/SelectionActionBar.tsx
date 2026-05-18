import type { ReactElement } from 'react';
import { Button } from 'primereact/button';
import type { VideoRow } from '../../shared/types/video';

interface SelectionActionBarProps {
  rowsExist: boolean;
  selectedVideos: VideoRow[];
  removedVideoCount: number;
  isAuditActive: boolean;
  isAutoFixActive: boolean;
  isAutoCropActive: boolean;
  isMediaPreviewActive: boolean;
  isMigrationActive: boolean;
  isPremiereImportSubmitting: boolean;
  canAutoFixSelected: boolean;
  canOpenCropOptions: boolean;
  canGenerateThumbnails: boolean;
  canStartMigration: boolean;
  canEditSelectedInPremiere: boolean;
  onRemoveSelectedVideos: () => void;
  onRestoreRemovedVideos: () => void;
  onOpenAutoFixDialog: () => void;
  onOpenAutoCropDialog: () => void;
  onOpenThumbnailDialog: () => void;
  onOpenMigrationDialog: () => void;
  onEditSelectedInPremiere: () => void;
}

export function SelectionActionBar({
  rowsExist,
  selectedVideos,
  removedVideoCount,
  isAuditActive,
  isAutoFixActive,
  isAutoCropActive,
  isMediaPreviewActive,
  isMigrationActive,
  isPremiereImportSubmitting,
  canAutoFixSelected,
  canOpenCropOptions,
  canGenerateThumbnails,
  canStartMigration,
  canEditSelectedInPremiere,
  onRemoveSelectedVideos,
  onRestoreRemovedVideos,
  onOpenAutoFixDialog,
  onOpenAutoCropDialog,
  onOpenThumbnailDialog,
  onOpenMigrationDialog,
  onEditSelectedInPremiere
}: SelectionActionBarProps): ReactElement | null {
  const selectedCount = selectedVideos.length;

  if (!rowsExist && removedVideoCount === 0) {
    return null;
  }

  return (
    <section className="selection-action-bar" aria-label="Selected video actions">
      <div className="selection-action-copy">
        <strong>
          {selectedCount > 0
            ? `${selectedCount.toLocaleString()} selected`
            : 'No videos selected'}
        </strong>
        <span>
          {selectedCount > 0
            ? formatSelectedSize(selectedVideos)
            : 'Select rows for Auto-Fix, Crop, or Premiere actions.'}
        </span>
      </div>

      <div className="selection-action-buttons">
        {selectedCount > 0 ? (
          <Button
            label={`Remove (${selectedCount.toLocaleString()})`}
            icon="pi pi-eye-slash"
            severity="secondary"
            disabled={isAuditActive}
            onClick={onRemoveSelectedVideos}
          />
        ) : null}
        {removedVideoCount > 0 ? (
          <Button
            label={`Restore (${removedVideoCount.toLocaleString()})`}
            icon="pi pi-undo"
            severity="secondary"
            disabled={isAuditActive}
            onClick={onRestoreRemovedVideos}
          />
        ) : null}
        {selectedCount > 0 ? (
          <>
            <Button
              label="Auto-Fix"
              icon="pi pi-wrench"
              severity="help"
              loading={isAutoFixActive}
              disabled={!canAutoFixSelected}
              onClick={onOpenAutoFixDialog}
            />
            <Button
              label="Crop Options"
              icon="pi pi-crop"
              severity="help"
              loading={isAutoCropActive}
              disabled={!canOpenCropOptions}
              onClick={onOpenAutoCropDialog}
            />
          </>
        ) : null}
        {canGenerateThumbnails || selectedCount > 0 ? (
          <Button
            label={selectedCount > 0 ? 'Generate Thumbnails' : 'Generate All Thumbnails'}
            icon="pi pi-images"
            severity="info"
            loading={isMediaPreviewActive}
            disabled={!canGenerateThumbnails}
            onClick={onOpenThumbnailDialog}
          />
        ) : null}
        {canStartMigration ? (
          <Button
            label="Migrate New Edits"
            icon="pi pi-folder-open"
            severity="info"
            loading={isMigrationActive}
            disabled={!canStartMigration}
            onClick={onOpenMigrationDialog}
          />
        ) : null}
        {selectedCount > 0 ? (
          <Button
            label="Edit in Premiere"
            icon="pi pi-send"
            severity="success"
            loading={isPremiereImportSubmitting}
            disabled={!canEditSelectedInPremiere}
            onClick={onEditSelectedInPremiere}
          />
        ) : null}
      </div>
    </section>
  );
}

function formatSelectedSize(rows: VideoRow[]): string {
  const sizeMB = rows.reduce((total, row) => total + (row.sizeMB ?? 0), 0);

  if (sizeMB >= 1024) {
    return `${(sizeMB / 1024).toFixed(2)} GB`;
  }

  return `${sizeMB.toFixed(1)} MB`;
}
