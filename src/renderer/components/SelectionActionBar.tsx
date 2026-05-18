import { useMemo, useRef, type ReactElement } from 'react';
import { Button } from 'primereact/button';
import { Menu } from 'primereact/menu';
import type { MenuItem } from 'primereact/menuitem';
import type { DestinationConflictStrategy } from '../../shared/types/fileOperations';
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
  isTrashPlanning: boolean;
  isTrashExecuting: boolean;
  isMovePlanning: boolean;
  isMoveExecuting: boolean;
  isPremiereImportSubmitting: boolean;
  canAutoFixSelected: boolean;
  canOpenCropOptions: boolean;
  canGenerateThumbnails: boolean;
  canMoveSelectedToTrash: boolean;
  canMoveSelectedToFolder: boolean;
  canStartMigration: boolean;
  canEditSelectedInPremiere: boolean;
  onRemoveSelectedVideos: () => void;
  onRestoreRemovedVideos: () => void;
  onOpenAutoFixDialog: () => void;
  onOpenAutoCropDialog: () => void;
  onOpenThumbnailDialog: () => void;
  onOpenMigrationDialog: () => void;
  onOpenTrashDialog: () => void;
  onOpenMoveDialog: (conflictStrategy?: DestinationConflictStrategy) => void;
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
  isTrashPlanning,
  isTrashExecuting,
  isMovePlanning,
  isMoveExecuting,
  isPremiereImportSubmitting,
  canAutoFixSelected,
  canOpenCropOptions,
  canGenerateThumbnails,
  canMoveSelectedToTrash,
  canMoveSelectedToFolder,
  canStartMigration,
  canEditSelectedInPremiere,
  onRemoveSelectedVideos,
  onRestoreRemovedVideos,
  onOpenAutoFixDialog,
  onOpenAutoCropDialog,
  onOpenThumbnailDialog,
  onOpenMigrationDialog,
  onOpenTrashDialog,
  onOpenMoveDialog,
  onEditSelectedInPremiere
}: SelectionActionBarProps): ReactElement | null {
  const menuRef = useRef<Menu>(null);
  const selectedCount = selectedVideos.length;
  const hasSelection = selectedCount > 0;
  const hasTableActions = removedVideoCount > 0 || canStartMigration || canGenerateThumbnails;
  const hasOverflowActions = hasSelection || hasTableActions;
  const overflowItems = useMemo<MenuItem[]>(
    () => {
      const items: MenuItem[] = [];

      if (!hasSelection && canGenerateThumbnails) {
        items.push({
          label: 'Generate All Thumbnails',
          icon: 'pi pi-images',
          disabled: isMediaPreviewActive,
          command: onOpenThumbnailDialog
        });
      }

      if (canStartMigration) {
        items.push({
          label: 'Migrate New Edits',
          icon: 'pi pi-folder-open',
          disabled: isMigrationActive,
          command: onOpenMigrationDialog
        });
      }

      if (items.length > 0 && (removedVideoCount > 0 || hasSelection)) {
        items.push({ separator: true });
      }

      if (hasSelection) {
        items.push({
          label: `Move to Folder (${selectedCount.toLocaleString()})`,
          icon: 'pi pi-folder-open',
          disabled: !canMoveSelectedToFolder || isMovePlanning || isMoveExecuting,
          command: () => onOpenMoveDialog('skip')
        });

        items.push({
          label: 'Move to Folder (Rename Conflicts)',
          icon: 'pi pi-copy',
          disabled: !canMoveSelectedToFolder || isMovePlanning || isMoveExecuting,
          command: () => onOpenMoveDialog('rename-with-suffix')
        });

        items.push({
          label: `Move to Trash (${selectedCount.toLocaleString()})`,
          icon: 'pi pi-trash',
          disabled: !canMoveSelectedToTrash || isTrashPlanning || isTrashExecuting,
          command: onOpenTrashDialog
        });

        items.push({
          label: `Remove from Table (${selectedCount.toLocaleString()})`,
          icon: 'pi pi-eye-slash',
          disabled: isAuditActive,
          command: onRemoveSelectedVideos
        });
      }

      if (removedVideoCount > 0) {
        items.push({
          label: `Restore Removed (${removedVideoCount.toLocaleString()})`,
          icon: 'pi pi-undo',
          disabled: isAuditActive,
          command: onRestoreRemovedVideos
        });
      }

      return items;
    },
    [
      canGenerateThumbnails,
      canMoveSelectedToFolder,
      canMoveSelectedToTrash,
      canStartMigration,
      hasSelection,
      isAuditActive,
      isMediaPreviewActive,
      isMigrationActive,
      isMoveExecuting,
      isMovePlanning,
      isTrashExecuting,
      isTrashPlanning,
      onOpenMigrationDialog,
      onOpenMoveDialog,
      onOpenThumbnailDialog,
      onOpenTrashDialog,
      onRemoveSelectedVideos,
      onRestoreRemovedVideos,
      removedVideoCount,
      selectedCount
    ]
  );

  if (!hasSelection && !hasTableActions) {
    return null;
  }

  return (
    <section
      className={`selection-action-bar ${hasSelection ? 'is-active' : 'is-idle'}`}
      aria-label="Selected video actions"
    >
      <div className="selection-action-copy">
        <strong>
          {hasSelection
            ? `${selectedCount.toLocaleString()} selected`
            : 'Results actions'}
        </strong>
        <span>
          {hasSelection
            ? formatSelectedSummary(selectedVideos)
            : getNoSelectionMessage(rowsExist, removedVideoCount, hasTableActions)}
        </span>
      </div>

      <div className="selection-action-buttons">
        {hasSelection ? (
          <>
            <Button
              label="Auto-Fix"
              icon="pi pi-wrench"
              severity="help"
              loading={isAutoFixActive}
              disabled={!canAutoFixSelected}
              title={canAutoFixSelected ? 'Open Auto-Fix options for selected rows.' : getBusyDisabledReason()}
              onClick={onOpenAutoFixDialog}
            />
            <Button
              label="Crop Options"
              icon="pi pi-crop"
              severity="help"
              loading={isAutoCropActive}
              disabled={!canOpenCropOptions}
              title={canOpenCropOptions ? 'Open crop options for selected rows.' : getBusyDisabledReason()}
              onClick={onOpenAutoCropDialog}
            />
            <Button
              label="Generate Thumbnails"
              icon="pi pi-images"
              severity="info"
              loading={isMediaPreviewActive}
              disabled={!canGenerateThumbnails}
              title={canGenerateThumbnails ? 'Open thumbnail generation options.' : getBusyDisabledReason()}
              onClick={onOpenThumbnailDialog}
            />
            <Button
              label="Edit in Premiere"
              icon="pi pi-send"
              severity="success"
              loading={isPremiereImportSubmitting}
              disabled={!canEditSelectedInPremiere}
              title={
                canEditSelectedInPremiere
                  ? 'Send selected rows to Premiere.'
                  : 'Premiere bridge must be ready and no workflow can be active.'
              }
              onClick={onEditSelectedInPremiere}
            />
          </>
        ) : null}
        {hasOverflowActions ? (
          <>
            <Menu id="selection-action-more-menu" model={overflowItems} popup ref={menuRef} />
            <Button
              label="More"
              icon="pi pi-ellipsis-h"
              severity="secondary"
              outlined
              aria-haspopup
              aria-controls="selection-action-more-menu"
              onClick={(event) => menuRef.current?.toggle(event)}
            />
          </>
        ) : null}
      </div>
    </section>
  );
}

function formatSelectedSummary(rows: VideoRow[]): string {
  return `${formatSelectedSize(rows)} selected`;
}

function formatSelectedSize(rows: VideoRow[]): string {
  const sizeMB = rows.reduce((total, row) => total + (row.sizeMB ?? 0), 0);

  if (sizeMB >= 1024) {
    return `${(sizeMB / 1024).toFixed(2)} GB`;
  }

  return `${sizeMB.toFixed(1)} MB`;
}

function getNoSelectionMessage(rowsExist: boolean, removedVideoCount: number, hasTableActions: boolean): string {
  if (removedVideoCount > 0) {
    return `${removedVideoCount.toLocaleString()} removed row(s) can be restored from More.`;
  }

  if (hasTableActions) {
    return 'Use More for table-wide workflows or select rows for row actions.';
  }

  if (rowsExist) {
    return 'Select rows for Auto-Fix, Crop, thumbnails, or Premiere.';
  }

  return 'Run an audit to enable row actions.';
}

function getBusyDisabledReason(): string {
  return 'Select rows and wait for active workflows to finish.';
}
