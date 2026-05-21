import { createHash } from 'node:crypto';
import { basename, dirname, normalize, resolve } from 'node:path';
import type {
  DuplicateCandidateGroup,
  DuplicateScanProfile,
  DuplicateScanSource,
  VisualFingerprint,
  VisualFingerprintSample
} from '../../shared/types/duplicateScan';
import type { DiscoveredVideoFile } from '../../shared/types/audit';

const DEFAULT_HASH_DISTANCE_THRESHOLD = 8;
const DEFAULT_MIN_SEQUENTIAL_MATCHES = 8;
const MIN_USABLE_SAMPLE_COUNT = 3;
const MIN_CONFIDENCE = 0.62;
const MIN_DURATION_RATIO = 0.7;
const COMMON_HASH_FILE_RATIO = 0.25;
const COMMON_HASH_MIN_FILE_COUNT = 3;

interface VisualSampleRef {
  filePath: string;
  sample: VisualFingerprintSample;
}

interface MatchedSamplePair {
  sourceTimeSeconds: number;
  candidateTimeSeconds: number;
  distance: number;
}

interface VisualPairAnalysis {
  confidence: number;
  matchedFrameCount: number;
  sequentialMatchCount: number;
  matchedDurationSeconds: number;
  shorterVideoCoverageRatio: number;
  averageHashDistance: number;
  medianHashDistance: number;
  matchedSourceStartSeconds: number | undefined;
  matchedSourceEndSeconds: number | undefined;
  matchedCandidateStartSeconds: number | undefined;
  matchedCandidateEndSeconds: number | undefined;
  notes: string[];
}

export interface BuildVisualDuplicateCandidateGroupsOptions {
  sources: DuplicateScanSource[];
  scannedFiles: DiscoveredVideoFile[];
  fingerprintsByPath: Map<string, VisualFingerprint>;
  exactMatchPairKeys?: Set<string>;
  profile: DuplicateScanProfile;
  hashDistanceThreshold?: number;
  minSequentialMatches?: number;
  signal?: AbortSignal;
}

export function buildVisualDuplicateCandidateGroups({
  sources,
  scannedFiles,
  fingerprintsByPath,
  exactMatchPairKeys = new Set<string>(),
  profile,
  hashDistanceThreshold = DEFAULT_HASH_DISTANCE_THRESHOLD,
  minSequentialMatches = DEFAULT_MIN_SEQUENTIAL_MATCHES,
  signal
}: BuildVisualDuplicateCandidateGroupsOptions): DuplicateCandidateGroup[] {
  throwIfAborted(signal);

  const normalizedHashDistanceThreshold = normalizePositiveNumber(
    hashDistanceThreshold,
    DEFAULT_HASH_DISTANCE_THRESHOLD
  );
  const normalizedMinSequentialMatches = Math.max(
    1,
    Math.floor(normalizePositiveNumber(minSequentialMatches, DEFAULT_MIN_SEQUENTIAL_MATCHES))
  );
  const sourcePathSet = new Set(sources.map((source) => normalizePathForComparison(source.path)));
  const candidateFiles = scannedFiles.filter(
    (file) => !sourcePathSet.has(normalizePathForComparison(file.path))
  );
  const allFingerprints = [...fingerprintsByPath.values()];
  const commonHashes = findCommonHashes(allFingerprints);
  const candidateSamplesByHash = buildCandidateHashIndex({
    candidateFiles,
    fingerprintsByPath,
    commonHashes
  });
  const pairExactHashCounts = new Map<string, number>();

  for (const source of sources) {
    throwIfAborted(signal);

    const sourceFingerprint = fingerprintsByPath.get(source.path);

    if (!sourceFingerprint) {
      continue;
    }

    const sourceSamples = getUsableSamples(sourceFingerprint, commonHashes);
    const minimumSharedHashes = sourceSamples.length <= 5 ? 1 : 2;

    for (const sample of sourceSamples) {
      const candidateRefs = candidateSamplesByHash.get(sample.hash) ?? [];

      for (const candidateRef of candidateRefs) {
        throwIfAborted(signal);

        const pairKey = createDuplicatePairKey(source.path, candidateRef.filePath);

        if (
          exactMatchPairKeys.has(pairKey) ||
          normalizePathForComparison(source.path) === normalizePathForComparison(candidateRef.filePath)
        ) {
          continue;
        }

        pairExactHashCounts.set(pairKey, (pairExactHashCounts.get(pairKey) ?? 0) + 1);
      }
    }

  }

  const groups: DuplicateCandidateGroup[] = [];

  for (const source of sources) {
    throwIfAborted(signal);

    const sourceFingerprint = fingerprintsByPath.get(source.path);

    if (!sourceFingerprint) {
      continue;
    }

    const sourcePairPrefix = `${normalizePathForComparison(source.path)}::`;

    for (const [pairKey, sharedHashCount] of pairExactHashCounts) {
      throwIfAborted(signal);

      if (!pairKey.startsWith(sourcePairPrefix)) {
        continue;
      }

      const candidatePath = pairKey.slice(sourcePairPrefix.length);
      const candidateFingerprint = fingerprintsByPath.get(candidatePath);

      if (!candidateFingerprint) {
        continue;
      }

      const sourceUsableSampleCount = getUsableSamples(sourceFingerprint, commonHashes).length;
      const minimumSharedHashes = sourceUsableSampleCount <= 5 ? 1 : 2;

      if (sharedHashCount < minimumSharedHashes) {
        continue;
      }

      const analysis = analyzeVisualPair({
        sourceFingerprint,
        candidateFingerprint,
        commonHashes,
        hashDistanceThreshold: normalizedHashDistanceThreshold,
        minSequentialMatches: normalizedMinSequentialMatches
      });

      if (!analysis) {
        continue;
      }

      groups.push(
        createVisualCandidateGroup({
          source,
          sourceFingerprint,
          candidateFingerprint,
          analysis,
          profile
        })
      );
    }
  }

  return groups.sort(
    (left, right) =>
      right.confidence - left.confidence ||
      left.files[0].fileName.localeCompare(right.files[0].fileName) ||
      left.files[1].fileName.localeCompare(right.files[1].fileName)
  );
}

export function createDuplicatePairKey(leftPath: string, rightPath: string): string {
  return `${normalizePathForComparison(leftPath)}::${normalizePathForComparison(rightPath)}`;
}

function buildCandidateHashIndex({
  candidateFiles,
  fingerprintsByPath,
  commonHashes
}: {
  candidateFiles: DiscoveredVideoFile[];
  fingerprintsByPath: Map<string, VisualFingerprint>;
  commonHashes: Set<string>;
}): Map<string, VisualSampleRef[]> {
  const samplesByHash = new Map<string, VisualSampleRef[]>();

  for (const file of candidateFiles) {
    const fingerprint = fingerprintsByPath.get(file.path);

    if (!fingerprint) {
      continue;
    }

    for (const sample of getUsableSamples(fingerprint, commonHashes)) {
      const refs = samplesByHash.get(sample.hash) ?? [];
      refs.push({
        filePath: fingerprint.filePath,
        sample
      });
      samplesByHash.set(sample.hash, refs);
    }
  }

  return samplesByHash;
}

function analyzeVisualPair({
  sourceFingerprint,
  candidateFingerprint,
  commonHashes,
  hashDistanceThreshold,
  minSequentialMatches
}: {
  sourceFingerprint: VisualFingerprint;
  candidateFingerprint: VisualFingerprint;
  commonHashes: Set<string>;
  hashDistanceThreshold: number;
  minSequentialMatches: number;
}): VisualPairAnalysis | null {
  const sourceSamples = getUsableSamples(sourceFingerprint, commonHashes);
  const candidateSamples = getUsableSamples(candidateFingerprint, commonHashes);
  const shorterUsableSampleCount = Math.min(sourceSamples.length, candidateSamples.length);

  if (shorterUsableSampleCount < MIN_USABLE_SAMPLE_COUNT) {
    return null;
  }

  const durationSimilarity = getDurationSimilarity(sourceFingerprint, candidateFingerprint);

  if (durationSimilarity !== null && durationSimilarity < MIN_DURATION_RATIO) {
    return null;
  }

  const matchedPairs = getAlignedMatches({
    sourceSamples,
    candidateSamples,
    sourceDurationSeconds: sourceFingerprint.durationSeconds,
    candidateDurationSeconds: candidateFingerprint.durationSeconds,
    sampleIntervalSeconds: Math.max(
      sourceFingerprint.sampleIntervalSeconds,
      candidateFingerprint.sampleIntervalSeconds
    ),
    hashDistanceThreshold
  });

  if (matchedPairs.length === 0) {
    return null;
  }

  const longestRun = getLongestSequentialRun(
    matchedPairs,
    Math.max(sourceFingerprint.sampleIntervalSeconds, candidateFingerprint.sampleIntervalSeconds)
  );
  const matchedDurationSeconds = getMatchedDurationSeconds(
    longestRun,
    Math.max(sourceFingerprint.sampleIntervalSeconds, candidateFingerprint.sampleIntervalSeconds)
  );
  const shorterVideoCoverageRatio = matchedPairs.length / shorterUsableSampleCount;
  const averageHashDistance = average(matchedPairs.map((pair) => pair.distance));
  const medianHashDistance = median(matchedPairs.map((pair) => pair.distance));
  const distanceScore = clamp01(1 - averageHashDistance / Math.max(1, hashDistanceThreshold));
  const sequentialConsistency = longestRun.length / Math.max(1, matchedPairs.length);
  const durationScore = durationSimilarity ?? 0.75;
  const metadataScore = getMetadataCompatibilityScore(sourceFingerprint, candidateFingerprint);
  const confidence = clamp01(
    0.4 * shorterVideoCoverageRatio +
      0.25 * sequentialConsistency +
      0.2 * distanceScore +
      0.1 * durationScore +
      0.05 * metadataScore
  );

  if (
    confidence < MIN_CONFIDENCE ||
    !hasEnoughSequenceEvidence({
      matchedPairs,
      longestRun,
      matchedDurationSeconds,
      shorterVideoCoverageRatio,
      minSequentialMatches
    })
  ) {
    return null;
  }

  return {
    confidence: Number(confidence.toFixed(3)),
    matchedFrameCount: matchedPairs.length,
    sequentialMatchCount: longestRun.length,
    matchedDurationSeconds: Number(matchedDurationSeconds.toFixed(3)),
    shorterVideoCoverageRatio: Number(shorterVideoCoverageRatio.toFixed(3)),
    averageHashDistance: Number(averageHashDistance.toFixed(3)),
    medianHashDistance: Number(medianHashDistance.toFixed(3)),
    matchedSourceStartSeconds: first(longestRun)?.sourceTimeSeconds,
    matchedSourceEndSeconds: last(longestRun)?.sourceTimeSeconds,
    matchedCandidateStartSeconds: first(longestRun)?.candidateTimeSeconds,
    matchedCandidateEndSeconds: last(longestRun)?.candidateTimeSeconds,
    notes: [
      `Visual candidate scored with ${matchedPairs.length.toLocaleString()} aligned frame match(es).`
    ]
  };
}

function getAlignedMatches({
  sourceSamples,
  candidateSamples,
  sourceDurationSeconds,
  candidateDurationSeconds,
  sampleIntervalSeconds,
  hashDistanceThreshold
}: {
  sourceSamples: VisualFingerprintSample[];
  candidateSamples: VisualFingerprintSample[];
  sourceDurationSeconds: number | null;
  candidateDurationSeconds: number | null;
  sampleIntervalSeconds: number;
  hashDistanceThreshold: number;
}): MatchedSamplePair[] {
  const matches: MatchedSamplePair[] = [];
  const usedCandidateIndexes = new Set<number>();
  const timeScale =
    sourceDurationSeconds && candidateDurationSeconds && sourceDurationSeconds > 0
      ? candidateDurationSeconds / sourceDurationSeconds
      : 1;
  const timestampToleranceSeconds = Math.max(1, sampleIntervalSeconds * 0.75);

  for (const sourceSample of sourceSamples) {
    let bestMatch: { index: number; sample: VisualFingerprintSample; distance: number } | null = null;
    const expectedCandidateTime = sourceSample.timeSeconds * timeScale;

    for (let index = 0; index < candidateSamples.length; index += 1) {
      if (usedCandidateIndexes.has(index)) {
        continue;
      }

      const candidateSample = candidateSamples[index];
      const timestampDelta = Math.abs(candidateSample.timeSeconds - expectedCandidateTime);

      if (timestampDelta > timestampToleranceSeconds) {
        continue;
      }

      const distance = getHammingDistance(sourceSample.hash, candidateSample.hash);

      if (distance > hashDistanceThreshold) {
        continue;
      }

      if (
        !bestMatch ||
        distance < bestMatch.distance ||
        (distance === bestMatch.distance &&
          timestampDelta < Math.abs(bestMatch.sample.timeSeconds - expectedCandidateTime))
      ) {
        bestMatch = {
          index,
          sample: candidateSample,
          distance
        };
      }
    }

    if (!bestMatch) {
      continue;
    }

    usedCandidateIndexes.add(bestMatch.index);
    matches.push({
      sourceTimeSeconds: sourceSample.timeSeconds,
      candidateTimeSeconds: bestMatch.sample.timeSeconds,
      distance: bestMatch.distance
    });
  }

  return matches.sort(
    (left, right) =>
      left.sourceTimeSeconds - right.sourceTimeSeconds ||
      left.candidateTimeSeconds - right.candidateTimeSeconds
  );
}

function getLongestSequentialRun(
  matches: MatchedSamplePair[],
  sampleIntervalSeconds: number
): MatchedSamplePair[] {
  let currentRun: MatchedSamplePair[] = [];
  let bestRun: MatchedSamplePair[] = [];
  const maxGapSeconds = Math.max(1, sampleIntervalSeconds * 2.5);

  for (const match of matches) {
    const previous = last(currentRun);

    if (
      previous &&
      match.sourceTimeSeconds > previous.sourceTimeSeconds &&
      match.candidateTimeSeconds > previous.candidateTimeSeconds &&
      match.sourceTimeSeconds - previous.sourceTimeSeconds <= maxGapSeconds &&
      match.candidateTimeSeconds - previous.candidateTimeSeconds <= maxGapSeconds
    ) {
      currentRun.push(match);
    } else {
      currentRun = [match];
    }

    if (currentRun.length > bestRun.length) {
      bestRun = [...currentRun];
    }
  }

  return bestRun;
}

function hasEnoughSequenceEvidence({
  matchedPairs,
  longestRun,
  matchedDurationSeconds,
  shorterVideoCoverageRatio,
  minSequentialMatches
}: {
  matchedPairs: MatchedSamplePair[];
  longestRun: MatchedSamplePair[];
  matchedDurationSeconds: number;
  shorterVideoCoverageRatio: number;
  minSequentialMatches: number;
}): boolean {
  return (
    longestRun.length >= minSequentialMatches ||
    matchedDurationSeconds >= 30 ||
    (shorterVideoCoverageRatio >= 0.6 &&
      longestRun.length >= MIN_USABLE_SAMPLE_COUNT &&
      matchedPairs.length >= MIN_USABLE_SAMPLE_COUNT)
  );
}

function createVisualCandidateGroup({
  source,
  sourceFingerprint,
  candidateFingerprint,
  analysis,
  profile
}: {
  source: DuplicateScanSource;
  sourceFingerprint: VisualFingerprint;
  candidateFingerprint: VisualFingerprint;
  analysis: VisualPairAnalysis;
  profile: DuplicateScanProfile;
}): DuplicateCandidateGroup {
  const groupHash = createHash('sha256')
    .update(
      JSON.stringify({
        mode: 'visual-fingerprint',
        sourcePath: sourceFingerprint.filePath,
        candidatePath: candidateFingerprint.filePath,
        sourceStart: analysis.matchedSourceStartSeconds,
        candidateStart: analysis.matchedCandidateStartSeconds
      })
    )
    .digest('hex')
    .slice(0, 16);

  return {
    id: `visual-fingerprint:${groupHash}`,
    mode: 'visual-fingerprint',
    confidence: analysis.confidence,
    matchType: 'near-duplicate',
    files: [
      {
        id: source.id,
        role: 'source',
        filePath: sourceFingerprint.filePath,
        fileName: sourceFingerprint.fileName || basename(sourceFingerprint.filePath),
        directory: sourceFingerprint.directory || dirname(sourceFingerprint.filePath),
        durationSeconds: sourceFingerprint.durationSeconds,
        width: sourceFingerprint.width,
        height: sourceFingerprint.height,
        sizeBytes: sourceFingerprint.sizeBytes,
        modifiedAtMs: sourceFingerprint.modifiedTimeMs,
        matchedStartSeconds: analysis.matchedSourceStartSeconds,
        matchedEndSeconds: analysis.matchedSourceEndSeconds
      },
      {
        id: `visual-fingerprint:${groupHash}:candidate`,
        role: 'candidate',
        filePath: candidateFingerprint.filePath,
        fileName: candidateFingerprint.fileName || basename(candidateFingerprint.filePath),
        directory: candidateFingerprint.directory || dirname(candidateFingerprint.filePath),
        durationSeconds: candidateFingerprint.durationSeconds,
        width: candidateFingerprint.width,
        height: candidateFingerprint.height,
        sizeBytes: candidateFingerprint.sizeBytes,
        modifiedAtMs: candidateFingerprint.modifiedTimeMs,
        matchedStartSeconds: analysis.matchedCandidateStartSeconds,
        matchedEndSeconds: analysis.matchedCandidateEndSeconds,
        reviewStatus: 'unreviewed'
      }
    ],
    evidence: {
      matchedFrameCount: analysis.matchedFrameCount,
      sequentialMatchCount: analysis.sequentialMatchCount,
      matchedDurationSeconds: analysis.matchedDurationSeconds,
      shorterVideoCoverageRatio: analysis.shorterVideoCoverageRatio,
      averageHashDistance: analysis.averageHashDistance,
      medianHashDistance: analysis.medianHashDistance,
      sampleIntervalSeconds: Math.max(
        sourceFingerprint.sampleIntervalSeconds,
        candidateFingerprint.sampleIntervalSeconds
      ),
      algorithm: sourceFingerprint.algorithm,
      notes: [
        ...analysis.notes,
        `Profile: ${profile}.`,
        'Low-information samples and common hashes were excluded from visual matching.'
      ]
    }
  };
}

function findCommonHashes(fingerprints: VisualFingerprint[]): Set<string> {
  const filesByHash = new Map<string, Set<string>>();

  for (const fingerprint of fingerprints) {
    const uniqueHashes = new Set(
      fingerprint.samples
        .filter((sample) => isUsableSample(sample))
        .map((sample) => sample.hash)
    );

    for (const hash of uniqueHashes) {
      const filePaths = filesByHash.get(hash) ?? new Set<string>();
      filePaths.add(fingerprint.filePath);
      filesByHash.set(hash, filePaths);
    }
  }

  const threshold = Math.max(
    COMMON_HASH_MIN_FILE_COUNT,
    Math.ceil(fingerprints.length * COMMON_HASH_FILE_RATIO)
  );
  const commonHashes = new Set<string>();

  for (const [hash, filePaths] of filesByHash) {
    if (filePaths.size > threshold) {
      commonHashes.add(hash);
    }
  }

  return commonHashes;
}

function getUsableSamples(
  fingerprint: VisualFingerprint,
  commonHashes: Set<string>
): VisualFingerprintSample[] {
  return fingerprint.samples
    .filter((sample) => isUsableSample(sample) && !commonHashes.has(sample.hash))
    .sort((left, right) => left.timeSeconds - right.timeSeconds);
}

function isUsableSample(sample: VisualFingerprintSample): boolean {
  return Boolean(sample.hash) && sample.isLowInformation !== true;
}

function getDurationSimilarity(
  sourceFingerprint: VisualFingerprint,
  candidateFingerprint: VisualFingerprint
): number | null {
  const sourceDuration = sourceFingerprint.durationSeconds;
  const candidateDuration = candidateFingerprint.durationSeconds;

  if (!sourceDuration || !candidateDuration || sourceDuration <= 0 || candidateDuration <= 0) {
    return null;
  }

  return clamp01(Math.min(sourceDuration, candidateDuration) / Math.max(sourceDuration, candidateDuration));
}

function getMetadataCompatibilityScore(
  sourceFingerprint: VisualFingerprint,
  candidateFingerprint: VisualFingerprint
): number {
  if (
    !sourceFingerprint.width ||
    !sourceFingerprint.height ||
    !candidateFingerprint.width ||
    !candidateFingerprint.height
  ) {
    return 0.75;
  }

  const sourceAspectRatio = sourceFingerprint.width / sourceFingerprint.height;
  const candidateAspectRatio = candidateFingerprint.width / candidateFingerprint.height;
  const aspectDelta = Math.abs(sourceAspectRatio - candidateAspectRatio);

  return aspectDelta <= 0.03 ? 1 : aspectDelta <= 0.1 ? 0.7 : 0.35;
}

function getMatchedDurationSeconds(
  matches: MatchedSamplePair[],
  sampleIntervalSeconds: number
): number {
  if (matches.length === 0) {
    return 0;
  }

  if (matches.length === 1) {
    return sampleIntervalSeconds;
  }

  return Math.max(
    sampleIntervalSeconds,
    last(matches)!.sourceTimeSeconds - first(matches)!.sourceTimeSeconds + sampleIntervalSeconds
  );
}

function getHammingDistance(leftHash: string, rightHash: string): number {
  const minLength = Math.min(leftHash.length, rightHash.length);
  let distance = Math.abs(leftHash.length - rightHash.length) * 4;

  for (let index = 0; index < minLength; index += 1) {
    const leftNibble = parseInt(leftHash[index], 16);
    const rightNibble = parseInt(rightHash[index], 16);

    if (Number.isNaN(leftNibble) || Number.isNaN(rightNibble)) {
      return Number.POSITIVE_INFINITY;
    }

    distance += NIBBLE_POPCOUNT[leftNibble ^ rightNibble];
  }

  return distance;
}

const NIBBLE_POPCOUNT = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((total, value) => total + value, 0) / values.length;
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const sortedValues = [...values].sort((left, right) => left - right);
  const middleIndex = Math.floor(sortedValues.length / 2);

  if (sortedValues.length % 2 === 1) {
    return sortedValues[middleIndex];
  }

  return (sortedValues[middleIndex - 1] + sortedValues[middleIndex]) / 2;
}

function first<T>(items: T[]): T | undefined {
  return items[0];
}

function last<T>(items: T[]): T | undefined {
  return items.length > 0 ? items[items.length - 1] : undefined;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function normalizePositiveNumber(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function normalizePathForComparison(value: string): string {
  return normalize(resolve(value));
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    const error = new Error('Visual duplicate matching canceled.');
    error.name = 'AbortError';
    throw error;
  }
}
