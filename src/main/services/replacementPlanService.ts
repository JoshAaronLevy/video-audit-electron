import { randomUUID } from 'node:crypto';
import { basename, dirname, extname, join, normalize, parse } from 'node:path';
import type {
  AutoCropResult,
  AutoCropResultItem
} from '../../shared/types/autoCrop';
import type {
  AutoFixResult,
  AutoFixResultItem
} from '../../shared/types/autoFix';
import type {
  FileIdentity,
  KnownPathValidationResult
} from '../../shared/types/fileOperations';
import type {
  CreateReplacementPlanRequest,
  CreateReplacementPlanResponse,
  ReplacementAction,
  ReplacementPlan,
  ReplacementPlanInputItem,
  ReplacementPlanItem,
  ReplacementPlanItemStatus,
  ReplacementPlanSource,
  ReplacementPlanWarningCode,
  ReplacementPlanErrorCode,
  UpdateReplacementPlanActionsRequest,
  UpdateReplacementPlanActionsResponse
} from '../../shared/types/replacementWorkflow';
import { validateKnownPath } from '../utils/fileOperationSafety';

const REPLACEMENT_ACTIONS: ReplacementAction[] = [
  'replace-original',
  'keep-output',
  'move-output',
  'trash-original',
  'archive-original',
  'skip'
];
const replacementPlans = new Map<string, ReplacementPlan>();

export async function createReplacementPlan(
  request: Partial<CreateReplacementPlanRequest> | null | undefined
): Promise<CreateReplacementPlanResponse> {
  const normalized = normalizeReplacementPlanRequest(request);

  if (!normalized.ok) {
    return {
      status: 'invalid_request',
      message: normalized.message
    };
  }

  const items: ReplacementPlanItem[] = [];

  for (const item of normalized.items) {
    items.push(await buildReplacementPlanItem(item, normalizeReplacementAction(item.selectedAction ?? normalized.defaultAction)));
  }

  const plan: ReplacementPlan = {
    id: randomUUID(),
    source: normalized.source,
    createdAt: new Date().toISOString(),
    defaultAction: normalized.defaultAction,
    items,
    summary: summarizeReplacementPlanItems(items)
  };

  replacementPlans.set(plan.id, plan);

  return {
    status: 'planned',
    plan
  };
}

export function getStoredReplacementPlan(planId: string): ReplacementPlan | null {
  return replacementPlans.get(planId) ?? null;
}

export async function updateReplacementPlanActions(
  request: Partial<UpdateReplacementPlanActionsRequest> | null | undefined
): Promise<UpdateReplacementPlanActionsResponse> {
  const normalized = normalizeReplacementPlanActionUpdateRequest(request);

  if (!normalized.ok) {
    return {
      status: 'invalid_request',
      message: normalized.message
    };
  }

  const plan = replacementPlans.get(normalized.planId);

  if (!plan) {
    return {
      status: 'not_found',
      message: 'Replacement plan not found. Create a fresh replacement plan before updating actions.'
    };
  }

  const existingItemIds = new Set(plan.items.map((item) => item.id));
  const actionByItemId = new Map<string, ReplacementAction>();

  for (const action of normalized.actions) {
    if (!existingItemIds.has(action.itemId)) {
      return {
        status: 'invalid_request',
        message: `Replacement plan item was not found: ${action.itemId}`
      };
    }

    actionByItemId.set(action.itemId, action.selectedAction);
  }

  const items: ReplacementPlanItem[] = [];

  for (const item of plan.items) {
    const selectedAction = actionByItemId.get(item.id) ?? item.selectedAction;
    items.push(await buildReplacementPlanItem(toReplacementPlanInputItem(item), selectedAction));
  }

  const updatedPlan: ReplacementPlan = {
    ...plan,
    items,
    summary: summarizeReplacementPlanItems(items)
  };

  replacementPlans.set(updatedPlan.id, updatedPlan);

  return {
    status: 'updated',
    plan: updatedPlan
  };
}

export function deleteStoredReplacementPlan(planId: string): void {
  replacementPlans.delete(planId);
}

async function buildReplacementPlanItem(
  item: ReplacementPlanInputItem,
  selectedAction: ReplacementAction
): Promise<ReplacementPlanItem> {
  const originalPath = normalizePathString(item.originalPath);
  const outputPath = normalizePathString(item.outputPath);
  const originalValidation = await validateKnownPath({
    id: item.id ?? undefined,
    path: originalPath,
    expectedKind: 'file',
    expectedFileName: item.originalFileName ?? null,
    expectedSizeBytes: item.originalSizeBytes ?? null,
    expectedModifiedAtMs: item.originalModifiedAtMs ?? null,
    requireSupportedVideoExtension: true
  });
  const outputValidation = await validateKnownPath({
    id: item.id ?? undefined,
    path: outputPath,
    expectedKind: 'file',
    expectedFileName: item.outputFileName ?? null,
    expectedSizeBytes: item.outputSizeBytes ?? null,
    expectedModifiedAtMs: item.outputModifiedAtMs ?? null,
    requireSupportedVideoExtension: true
  });
  const originalIdentity = originalValidation.identity;
  const outputIdentity = outputValidation.identity;
  const originalFileName = getFileName({
    identity: originalIdentity,
    providedFileName: item.originalFileName,
    path: originalPath,
    fallback: 'Unknown original'
  });
  const outputFileName = getFileName({
    identity: outputIdentity,
    providedFileName: item.outputFileName,
    path: outputPath,
    fallback: 'Unknown output'
  });
  const originalDirectory = originalPath ? dirname(originalPath) : '';
  const outputDirectory = outputPath ? dirname(outputPath) : '';
  const originalExtension = getFileExtension(originalIdentity, originalFileName, originalPath);
  const outputExtension = getFileExtension(outputIdentity, outputFileName, outputPath);
  const proposedFinalPath = getProposedFinalPath({
    originalDirectory,
    originalFileName,
    outputFileName,
    outputExtension
  });
  const warnings: string[] = [];
  const warningCodes: ReplacementPlanWarningCode[] = [];
  const errors: string[] = [];
  const errorCodes: ReplacementPlanErrorCode[] = [];

  if (item.conversionStatus && item.conversionStatus !== 'success') {
    warnings.push(`Conversion item status is ${item.conversionStatus}.`);
    warningCodes.push('conversion-not-successful');
  }

  if (originalExtension && outputExtension && originalExtension !== outputExtension) {
    warnings.push(`Converted extension changes from ${originalExtension} to ${outputExtension}.`);
    warningCodes.push('extension-changed');
  }

  addOriginalValidationMessages({
    validation: originalValidation,
    selectedAction,
    warnings,
    warningCodes,
    errors,
    errorCodes
  });
  addOutputValidationMessages({
    validation: outputValidation,
    errors,
    errorCodes
  });

  if (proposedFinalPath && outputValidation.isValid) {
    await addDestinationConflictMessages({
      proposedFinalPath,
      originalPath,
      outputPath,
      warnings,
      warningCodes,
      errors,
      errorCodes
    });
  }

  const status = getReplacementPlanItemStatus({
    warnings,
    errorCodes
  });

  return {
    id: item.id ?? randomUUID(),
    source: item.source ?? 'items',
    originalPath,
    originalFileName,
    originalDirectory,
    originalExtension,
    originalSizeBytes: originalIdentity?.sizeBytes ?? item.originalSizeBytes ?? null,
    originalModifiedAtMs: originalIdentity?.modifiedAtMs ?? item.originalModifiedAtMs ?? null,
    originalIdentity,
    outputPath,
    outputFileName,
    outputDirectory,
    outputExtension,
    outputSizeBytes: outputIdentity?.sizeBytes ?? item.outputSizeBytes ?? null,
    outputModifiedAtMs: outputIdentity?.modifiedAtMs ?? item.outputModifiedAtMs ?? null,
    outputIdentity,
    proposedFinalPath,
    selectedAction,
    status,
    warnings,
    warningCodes,
    errors,
    errorCodes,
    conversionStatus: item.conversionStatus ?? null
  };
}

function normalizeReplacementPlanRequest(
  request: Partial<CreateReplacementPlanRequest> | null | undefined
):
  | {
      ok: true;
      source: ReplacementPlanSource;
      defaultAction: ReplacementAction;
      items: ReplacementPlanInputItem[];
    }
  | { ok: false; message: string } {
  if (!request || typeof request !== 'object') {
    return {
      ok: false,
      message: 'Replacement plan request is required.'
    };
  }

  const source = normalizeSource(request.source);

  if (!source) {
    return {
      ok: false,
      message: 'Replacement plan source is required.'
    };
  }

  const defaultAction = normalizeReplacementAction(request.defaultAction);
  const items = getReplacementInputItems({
    source,
    autoFixResult: request.autoFixResult ?? null,
    autoCropResult: request.autoCropResult ?? null,
    items: request.items
  });

  if (items.length === 0) {
    return {
      ok: false,
      message: 'Replacement plan needs at least one conversion item.'
    };
  }

  return {
    ok: true,
    source,
    defaultAction,
    items
  };
}

function normalizeReplacementPlanActionUpdateRequest(
  request: Partial<UpdateReplacementPlanActionsRequest> | null | undefined
):
  | {
      ok: true;
      planId: string;
      actions: { itemId: string; selectedAction: ReplacementAction }[];
    }
  | { ok: false; message: string } {
  if (!request || typeof request !== 'object') {
    return {
      ok: false,
      message: 'Replacement plan action update request is required.'
    };
  }

  const planId = normalizePathString(request.planId);

  if (!planId) {
    return {
      ok: false,
      message: 'Replacement plan ID is required.'
    };
  }

  if (!Array.isArray(request.actions)) {
    return {
      ok: false,
      message: 'Replacement plan action updates are required.'
    };
  }

  const actions: { itemId: string; selectedAction: ReplacementAction }[] = [];

  for (const action of request.actions) {
    if (!action || typeof action !== 'object') {
      return {
        ok: false,
        message: 'Each replacement plan action update must be an object.'
      };
    }

    const itemId = normalizePathString(action.itemId);

    if (!itemId) {
      return {
        ok: false,
        message: 'Each replacement plan action update needs an item ID.'
      };
    }

    if (!isReplacementAction(action.selectedAction)) {
      return {
        ok: false,
        message: `Unsupported replacement action: ${String(action.selectedAction)}`
      };
    }

    actions.push({
      itemId,
      selectedAction: action.selectedAction
    });
  }

  if (actions.length === 0) {
    return {
      ok: false,
      message: 'At least one replacement plan action update is required.'
    };
  }

  return {
    ok: true,
    planId,
    actions
  };
}

function getReplacementInputItems({
  source,
  autoFixResult,
  autoCropResult,
  items
}: {
  source: ReplacementPlanSource;
  autoFixResult: AutoFixResult | null;
  autoCropResult: AutoCropResult | null;
  items: ReplacementPlanInputItem[] | undefined;
}): ReplacementPlanInputItem[] {
  if (source === 'auto-fix-result') {
    return autoFixResult?.items.map(toAutoFixReplacementInputItem) ?? [];
  }

  if (source === 'auto-crop-result') {
    return autoCropResult?.items.map(toAutoCropReplacementInputItem) ?? [];
  }

  return Array.isArray(items)
    ? items
        .filter((item): item is ReplacementPlanInputItem => Boolean(item) && typeof item === 'object')
        .map((item) => ({
          ...item,
          source: 'items'
        }))
    : [];
}

function toAutoFixReplacementInputItem(item: AutoFixResultItem): ReplacementPlanInputItem {
  return {
    id: item.id ?? item.sourcePath ?? item.outputPath ?? randomUUID(),
    source: 'auto-fix-result',
    originalPath: item.sourcePath ?? '',
    originalFileName: item.fileName,
    originalSizeBytes: item.sourceSizeBytes ?? null,
    outputPath: item.outputPath ?? '',
    outputFileName: item.outputFileName ?? null,
    outputSizeBytes: item.outputSizeBytes ?? null,
    conversionStatus: item.status
  };
}

function toAutoCropReplacementInputItem(item: AutoCropResultItem): ReplacementPlanInputItem {
  return {
    id: item.sourcePath || item.outputPath || randomUUID(),
    source: 'auto-crop-result',
    originalPath: item.sourcePath,
    originalFileName: item.fileName,
    originalSizeBytes: item.sourceSizeBytes ?? null,
    outputPath: item.outputPath ?? '',
    outputFileName: item.outputPath ? basename(item.outputPath) : null,
    outputSizeBytes: item.outputSizeBytes ?? null,
    conversionStatus: item.status
  };
}

function toReplacementPlanInputItem(item: ReplacementPlanItem): ReplacementPlanInputItem {
  return {
    id: item.id,
    source: item.source,
    originalPath: item.originalPath,
    originalFileName: item.originalFileName,
    originalSizeBytes: item.originalSizeBytes,
    originalModifiedAtMs: item.originalModifiedAtMs,
    outputPath: item.outputPath,
    outputFileName: item.outputFileName,
    outputSizeBytes: item.outputSizeBytes,
    outputModifiedAtMs: item.outputModifiedAtMs,
    selectedAction: item.selectedAction,
    conversionStatus: item.conversionStatus ?? null
  };
}

function addOriginalValidationMessages({
  validation,
  selectedAction,
  warnings,
  warningCodes,
  errors,
  errorCodes
}: {
  validation: KnownPathValidationResult;
  selectedAction: ReplacementAction;
  warnings: string[];
  warningCodes: ReplacementPlanWarningCode[];
  errors: string[];
  errorCodes: ReplacementPlanErrorCode[];
}): void {
  if (!validation.exists) {
    if (selectedAction === 'keep-output') {
      warnings.push('Original file is missing; output can be kept where it is.');
      warningCodes.push('missing-original-kept-output');
      return;
    }

    errors.push('Original file is missing.');
    errorCodes.push('missing-original');
    return;
  }

  if (!validation.isValid && selectedAction !== 'keep-output') {
    errors.push(...validation.errors);
    errorCodes.push('invalid-original');
  }
}

function addOutputValidationMessages({
  validation,
  errors,
  errorCodes
}: {
  validation: KnownPathValidationResult;
  errors: string[];
  errorCodes: ReplacementPlanErrorCode[];
}): void {
  if (!validation.exists) {
    errors.push('Converted output file is missing.');
    errorCodes.push('missing-output');
    return;
  }

  if (!validation.isValid) {
    errors.push(...validation.errors);
    errorCodes.push('invalid-output');
  }
}

async function addDestinationConflictMessages({
  proposedFinalPath,
  originalPath,
  outputPath,
  warnings,
  warningCodes,
  errors,
  errorCodes
}: {
  proposedFinalPath: string;
  originalPath: string;
  outputPath: string;
  warnings: string[];
  warningCodes: ReplacementPlanWarningCode[];
  errors: string[];
  errorCodes: ReplacementPlanErrorCode[];
}): Promise<void> {
  if (isSamePath(proposedFinalPath, originalPath)) {
    warnings.push('Final path matches the original path; execution must move the original away first.');
    warningCodes.push('final-path-matches-original');
    return;
  }

  if (outputPath && isSamePath(proposedFinalPath, outputPath)) {
    warnings.push('Converted output is already at the proposed final path.');
    warningCodes.push('output-already-at-final-path');
    return;
  }

  const finalValidation = await validateKnownPath({
    path: proposedFinalPath,
    expectedKind: 'any'
  });

  if (finalValidation.exists) {
    errors.push('Proposed final path already exists and is not the original or converted output.');
    errorCodes.push('destination-conflict');
  }
}

function getReplacementPlanItemStatus({
  warnings,
  errorCodes
}: {
  warnings: string[];
  errorCodes: ReplacementPlanErrorCode[];
}): ReplacementPlanItemStatus {
  if (errorCodes.includes('missing-output')) {
    return 'missing-output';
  }

  if (errorCodes.includes('missing-original')) {
    return 'missing-original';
  }

  if (errorCodes.includes('invalid-output')) {
    return 'invalid-output';
  }

  if (errorCodes.includes('invalid-original')) {
    return 'invalid-original';
  }

  if (errorCodes.includes('destination-conflict')) {
    return 'destination-conflict';
  }

  return warnings.length > 0 ? 'warning' : 'ready';
}

function summarizeReplacementPlanItems(items: ReplacementPlanItem[]): ReplacementPlan['summary'] {
  return {
    total: items.length,
    ready: items.filter((item) => item.status === 'ready').length,
    warning: items.filter((item) => item.status === 'warning').length,
    blocked: items.filter((item) => item.status !== 'ready' && item.status !== 'warning').length,
    missingOriginal: items.filter((item) => item.status === 'missing-original').length,
    missingOutput: items.filter((item) => item.status === 'missing-output').length,
    destinationConflicts: items.filter((item) => item.status === 'destination-conflict').length,
    totalOriginalSizeBytes: items.reduce((total, item) => total + (item.originalSizeBytes ?? 0), 0),
    totalOutputSizeBytes: items.reduce((total, item) => total + (item.outputSizeBytes ?? 0), 0)
  };
}

function getProposedFinalPath({
  originalDirectory,
  originalFileName,
  outputFileName,
  outputExtension
}: {
  originalDirectory: string;
  originalFileName: string;
  outputFileName: string;
  outputExtension: string;
}): string {
  if (!originalDirectory || !outputExtension) {
    return '';
  }

  const originalBaseName = parse(originalFileName).name || parse(outputFileName).name;

  if (!originalBaseName) {
    return '';
  }

  return join(originalDirectory, `${originalBaseName}${outputExtension}`);
}

function getFileName({
  identity,
  providedFileName,
  path,
  fallback
}: {
  identity: FileIdentity | null;
  providedFileName?: string | null;
  path: string;
  fallback: string;
}): string {
  if (identity?.fileName) {
    return identity.fileName;
  }

  if (providedFileName && providedFileName.trim()) {
    return providedFileName.trim();
  }

  if (path) {
    return basename(path);
  }

  return fallback;
}

function getFileExtension(identity: FileIdentity | null, fileName: string, path: string): string {
  return (identity?.extension || extname(fileName) || extname(path)).toLowerCase();
}

function normalizePathString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeSource(value: unknown): ReplacementPlanSource | null {
  return value === 'auto-fix-result' || value === 'auto-crop-result' || value === 'items' ? value : null;
}

function normalizeReplacementAction(value: unknown): ReplacementAction {
  return isReplacementAction(value) ? value : 'replace-original';
}

function isReplacementAction(value: unknown): value is ReplacementAction {
  return REPLACEMENT_ACTIONS.includes(value as ReplacementAction);
}

function isSamePath(left: string, right: string): boolean {
  return normalize(left) === normalize(right);
}
