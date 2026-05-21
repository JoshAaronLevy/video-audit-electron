import { createHash } from 'node:crypto';
import { basename, dirname, normalize, resolve } from 'node:path';
import type { DiscoveredVideoFile } from '../../shared/types/audit';
import type {
  DuplicateCandidateGroup,
  DuplicateScanProfile,
  DuplicateScanSource,
  VisualFingerprint,
  VisualFingerprintSample
} from '../../shared/types/duplicateScan';
import { createDuplicatePairKey } from './duplicateVisualMatcher';

const DEFAULT_HASH_DISTANCE_THRESHOLD = 8;
const DEFAULT_MIN_SEQUENTIAL_MATCHES = 5;
const MIN_USABLE_SAMPLE_COUNT = 3;
const MIN_DURATION_RATIO_FOR_CONTAINED_CLIP = 0.9;
const MIN_CONFIDENCE = 0.58;
const COMMON_HASH_FILE_RATIO = 0.25;
const COMMON_HASH_MIN_FILE_COUNT = 3;

interface ContainedClipSampleMatch {
  shortTimeSeconds: number;
  longTimeSeconds: number;
  offsetSeconds: number;
  distance: number;
}

interface ContainedClipAnalysis {
  confidence: number;
  matchedFrameCount: number;
  sequentialMatchCount: number;
  matchedDurationSeconds: number;
  shorterVideoCoverageRatio: number;
  averageHashDistance: number;
  medianHashDistance: number;
  offsetSeconds: number;
  offsetToleranceSeconds: number;
  shortStartSeconds: number | undefined;
  shortEndSeconds: number | undefined;
  longStartSeconds: number | undefined;
  longEndSeconds: number | undefined;
  notes: string[];
}

interface OrientedContainedClipPair {
  sourceFingerprint: VisualFingerprint;
  candidateFingerprint: VisualFingerprint;
  shortFingerprint: VisualFingerprint;
  longFingerprint: VisualFingerprint;
  sourceIsShort: boolean;
}

export interface BuildContainedClipCandidateGroupsOptions {
  sources: DuplicateScanSource[];
  scannedFiles: DiscoveredVideoFile[];
  fingerprintsByPath: Map<string, VisualFingerprint>;
  exactMatchPairKeys?: Set<string>;
  profile: DuplicateScanProfile;
  hashDistanceThreshold?: number;
  minSequentialMatches?: number;
  signal?: AbortSignal;
}

export function buildContainedClipCandidateGroups({
  sources,
  scannedFiles,
  fingerprintsByPath,
  exactMatchPairKeys = new Set<string>(),
  profile,
  hashDistanceThreshold = DEFAULT_HASH_DISTANCE_THRESHOLD,
  minSequentialMatches = DEFAULT_MIN_SEQUENTIAL_MATCHES,
  signal
}: BuildContainedClipCandidateGroupsOptions): DuplicateCandidateGroup[] {
  throwIfAborted(signal);

  const normalizedHashDistanceThreshold = normalizePositiveNumber(
    hashDistanceThreshold,
    DEFAULT_HASH_DISTANCE_THRESHOLD
  );
  const normalizedMinSequentialMatches = Math.max(
    3,
    Math.min(
      DEFAULT_MIN_SEQUENTIAL_MATCHES,
      Math.floor(normalizePositiveNumber(minSequentialMatches, DEFAULT_MIN_SEQUENTIAL_MATCHES))
    )
  );
  const sourcePathSet = new Set(sources.map((source) => normalizePathForComparison(source.path)));
  const candidateFiles = scannedFiles.filter(
    (file) => !sourcePathSet.has(normalizePathForComparison(file.path))
  );
  const allFingerprints = [...new Map([...fingerprintsByPath.values()].map((fingerprint) => [
    fingerprint.filePath,
    fingerprint
  ])).values()];
  const commonHashes = findCommonHashes(allFingerprints);
  const groups: DuplicateCandidateGroup[] = [];

  for (const source of sources) {
    throwIfAborted(signal);

    const sourceFingerprint = getFingerprint(fingerprintsByPath, source.path);

    if (!sourceFingerprint) {
      continue;
    }

    for (const file of candidateFiles) {
      throwIfAborted(signal);

      const candidateFingerprint = getFingerprint(fingerprintsByPath, file.path);

      if (!candidateFingerprint) {
        continue;
      }

      if (exactMatchPairKeys.has(createDuplicatePairKey(source.path, file.path))) {
        continue;
      }

      const orientedPair = orientContainedClipPair(sourceFingerprint, candidateFingerprint);

      if (!orientedPair) {
        continue;
      }

      const analysis = analyzeContainedClipPair({
        shortFingerprint: orientedPair.shortFingerprint,
        longFingerprint: orientedPair.longFingerprint,
        commonHashes,
        hashDistanceThreshold: normalizedHashDistanceThreshold,
        minSequentialMatches: normalizedMinSequentialMatches
      });

      if (!analysis) {
        continue;
      }

      groups.push(
        createContainedClipCandidateGroup({
          source,
          pair: orientedPair,
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

function orientContainedClipPair(
  sourceFingerprint: VisualFingerprint,
  candidateFingerprint: VisualFingerprint
): OrientedContainedClipPair | null {
  const sourceDuration = sourceFingerprint.durationSeconds;
  const candidateDuration = candidateFingerprint.durationSeconds;

  if (!sourceDuration || !candidateDuration || sourceDuration <= 0 || candidateDuration <= 0) {
    return null;
  }

  const shorterDuration = Math.min(sourceDuration, candidateDuration);
  const longerDuration = Math.max(sourceDuration, candidateDuration);

  if (shorterDuration > longerDuration * MIN_DURATION_RATIO_FOR_CONTAINED_CLIP) {
    return null;
  }

  const sourceIsShort = sourceDuration <= candidateDuration;

  return {
    sourceFingerprint,
    candidateFingerprint,
    shortFingerprint: sourceIsShort ? sourceFingerprint : candidateFingerprint,
    longFingerprint: sourceIsShort ? candidateFingerprint : sourceFingerprint,
    sourceIsShort
  };
}

function analyzeContainedClipPair({
  shortFingerprint,
  longFingerprint,
  commonHashes,
  hashDistanceThreshold,
  minSequentialMatches
}: {
  shortFingerprint: VisualFingerprint;
  longFingerprint: VisualFingerprint;
  commonHashes: Set<string>;
  hashDistanceThreshold: number;
  minSequentialMatches: number;
}): ContainedClipAnalysis | null {
  const shortSamples = getUsableSamples(shortFingerprint, commonHashes);
  const longSamples = getUsableSamples(longFingerprint, commonHashes);

  if (
    shortSamples.length < MIN_USABLE_SAMPLE_COUNT ||
    longSamples.length < MIN_USABLE_SAMPLE_COUNT
  ) {
    return null;
  }

  const sampleMatches = getContainedClipSampleMatches({
    shortSamples,
    longSamples,
    hashDistanceThreshold
  });

  if (sampleMatches.length < MIN_USABLE_SAMPLE_COUNT) {
    return null;
  }

  const offsetToleranceSeconds = Math.max(
    shortFingerprint.sampleIntervalSeconds,
    longFingerprint.sampleIntervalSeconds,
    1
  );
  const bestBucketMatches = getBestOffsetBucketMatches(sampleMatches, offsetToleranceSeconds);

  if (bestBucketMatches.length < MIN_USABLE_SAMPLE_COUNT) {
    return null;
  }

  const longestRun = getLongestConsistentOffsetRun(bestBucketMatches, offsetToleranceSeconds);
  const matchedDurationSeconds = getMatchedDurationSeconds(
    longestRun,
    shortFingerprint.sampleIntervalSeconds
  );
  const shorterVideoCoverageRatio = longestRun.length / shortSamples.length;
  const averageHashDistance = average(longestRun.map((match) => match.distance));
  const medianHashDistance = median(longestRun.map((match) => match.distance));
  const averageOffsetSeconds = average(longestRun.map((match) => match.offsetSeconds));
  const offsetConsistency = longestRun.length / bestBucketMatches.length;
  const sequentialRunScore = longestRun.length / Math.max(minSequentialMatches, shortSamples.length);
  const distanceScore = clamp01(1 - averageHashDistance / Math.max(1, hashDistanceThreshold));
  const confidence = clamp01(
    0.35 * shorterVideoCoverageRatio +
      0.3 * offsetConsistency +
      0.2 * clamp01(sequentialRunScore) +
      0.15 * distanceScore
  );

  if (
    confidence < MIN_CONFIDENCE ||
    !hasEnoughContainedClipEvidence({
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
    matchedFrameCount: bestBucketMatches.length,
    sequentialMatchCount: longestRun.length,
    matchedDurationSeconds: Number(matchedDurationSeconds.toFixed(3)),
    shorterVideoCoverageRatio: Number(shorterVideoCoverageRatio.toFixed(3)),
    averageHashDistance: Number(averageHashDistance.toFixed(3)),
    medianHashDistance: Number(medianHashDistance.toFixed(3)),
    offsetSeconds: Number(averageOffsetSeconds.toFixed(3)),
    offsetToleranceSeconds: Number(offsetToleranceSeconds.toFixed(3)),
    shortStartSeconds: first(longestRun)?.shortTimeSeconds,
    shortEndSeconds: last(longestRun)?.shortTimeSeconds,
    longStartSeconds: first(longestRun)?.longTimeSeconds,
    longEndSeconds: last(longestRun)?.longTimeSeconds,
    notes: [
      `Contained-clip candidate scored with ${longestRun.length.toLocaleString()} sequential offset-aligned match(es).`
    ]
  };
}

function getContainedClipSampleMatches({
  shortSamples,
  longSamples,
  hashDistanceThreshold
}: {
  shortSamples: VisualFingerprintSample[];
  longSamples: VisualFingerprintSample[];
  hashDistanceThreshold: number;
}): ContainedClipSampleMatch[] {
  const matches: ContainedClipSampleMatch[] = [];

  for (const shortSample of shortSamples) {
    for (const longSample of longSamples) {
      const distance = getHammingDistance(shortSample.hash, longSample.hash);

      if (distance > hashDistanceThreshold) {
        continue;
      }

      matches.push({
        shortTimeSeconds: shortSample.timeSeconds,
        longTimeSeconds: longSample.timeSeconds,
        offsetSeconds: longSample.timeSeconds - shortSample.timeSeconds,
        distance
      });
    }
  }

  return matches;
}

function getBestOffsetBucketMatches(
  matches: ContainedClipSampleMatch[],
  offsetToleranceSeconds: number
): ContainedClipSampleMatch[] {
  const matchesByBucket = new Map<number, ContainedClipSampleMatch[]>();

  for (const match of matches) {
    const bucket = Math.round(match.offsetSeconds / offsetToleranceSeconds);
    const bucketMatches = matchesByBucket.get(bucket) ?? [];
    bucketMatches.push(match);
    matchesByBucket.set(bucket, bucketMatches);
  }

  let bestMatches: ContainedClipSampleMatch[] = [];
  let bestScore = -1;

  for (const bucketMatches of matchesByBucket.values()) {
    const uniqueShortTimes = new Set(bucketMatches.map((match) => match.shortTimeSeconds)).size;
    const uniqueLongTimes = new Set(bucketMatches.map((match) => match.longTimeSeconds)).size;
    const score =
      Math.min(uniqueShortTimes, uniqueLongTimes) * 100 -
      average(bucketMatches.map((match) => match.distance));

    if (score > bestScore) {
      bestScore = score;
      bestMatches = bucketMatches;
    }
  }

  return dedupeMatchesByShortTimestamp(bestMatches).sort(
    (left, right) =>
      left.shortTimeSeconds - right.shortTimeSeconds ||
      left.longTimeSeconds - right.longTimeSeconds ||
      left.distance - right.distance
  );
}

function dedupeMatchesByShortTimestamp(
  matches: ContainedClipSampleMatch[]
): ContainedClipSampleMatch[] {
  const bestByShortTime = new Map<number, ContainedClipSampleMatch>();

  for (const match of matches) {
    const existing = bestByShortTime.get(match.shortTimeSeconds);

    if (
      !existing ||
      match.distance < existing.distance ||
      (match.distance === existing.distance &&
        Math.abs(match.offsetSeconds) < Math.abs(existing.offsetSeconds))
    ) {
      bestByShortTime.set(match.shortTimeSeconds, match);
    }
  }

  return [...bestByShortTime.values()];
}

function getLongestConsistentOffsetRun(
  matches: ContainedClipSampleMatch[],
  offsetToleranceSeconds: number
): ContainedClipSampleMatch[] {
  let currentRun: ContainedClipSampleMatch[] = [];
  let bestRun: ContainedClipSampleMatch[] = [];
  const maxGapSeconds = Math.max(1, offsetToleranceSeconds * 2.5);

  for (const match of matches) {
    const previous = last(currentRun);

    if (
      previous &&
      match.shortTimeSeconds > previous.shortTimeSeconds &&
      match.longTimeSeconds > previous.longTimeSeconds &&
      Math.abs(match.offsetSeconds - previous.offsetSeconds) <= offsetToleranceSeconds &&
      match.shortTimeSeconds - previous.shortTimeSeconds <= maxGapSeconds &&
      match.longTimeSeconds - previous.longTimeSeconds <= maxGapSeconds
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

function hasEnoughContainedClipEvidence({
  longestRun,
  matchedDurationSeconds,
  shorterVideoCoverageRatio,
  minSequentialMatches
}: {
  longestRun: ContainedClipSampleMatch[];
  matchedDurationSeconds: number;
  shorterVideoCoverageRatio: number;
  minSequentialMatches: number;
}): boolean {
  return (
    longestRun.length >= minSequentialMatches ||
    matchedDurationSeconds >= 30 ||
    (shorterVideoCoverageRatio >= 0.5 && longestRun.length >= MIN_USABLE_SAMPLE_COUNT)
  );
}

function createContainedClipCandidateGroup({
  source,
  pair,
  analysis,
  profile
}: {
  source: DuplicateScanSource;
  pair: OrientedContainedClipPair;
  analysis: ContainedClipAnalysis;
  profile: DuplicateScanProfile;
}): DuplicateCandidateGroup {
  const groupHash = createHash('sha256')
    .update(
      JSON.stringify({
        mode: 'contained-clip',
        sourcePath: pair.sourceFingerprint.filePath,
        candidatePath: pair.candidateFingerprint.filePath,
        offsetSeconds: analysis.offsetSeconds,
        shortStartSeconds: analysis.shortStartSeconds,
        longStartSeconds: analysis.longStartSeconds
      })
    )
    .digest('hex')
    .slice(0, 16);

  return {
    id: `contained-clip:${groupHash}`,
    mode: 'contained-clip',
    confidence: analysis.confidence,
    matchType: 'contained-clip',
    files: [
      createContainedClipFile({
        id: source.id,
        role: 'source',
        fingerprint: pair.sourceFingerprint,
        isShortFile: pair.sourceIsShort,
        analysis
      }),
      createContainedClipFile({
        id: `contained-clip:${groupHash}:candidate`,
        role: 'candidate',
        fingerprint: pair.candidateFingerprint,
        isShortFile: !pair.sourceIsShort,
        analysis
      })
    ],
    evidence: {
      matchedFrameCount: analysis.matchedFrameCount,
      sequentialMatchCount: analysis.sequentialMatchCount,
      matchedDurationSeconds: analysis.matchedDurationSeconds,
      shorterVideoCoverageRatio: analysis.shorterVideoCoverageRatio,
      averageHashDistance: analysis.averageHashDistance,
      medianHashDistance: analysis.medianHashDistance,
      offsetSeconds: analysis.offsetSeconds,
      offsetToleranceSeconds: analysis.offsetToleranceSeconds,
      sampleIntervalSeconds: Math.max(
        pair.shortFingerprint.sampleIntervalSeconds,
        pair.longFingerprint.sampleIntervalSeconds
      ),
      algorithm: pair.shortFingerprint.algorithm,
      notes: [
        ...analysis.notes,
        pair.sourceIsShort
          ? 'The selected source appears to be the shorter clip.'
          : 'The scanned candidate appears to be the shorter clip.',
        `Profile: ${profile}.`,
        'Evidence is based on a run of matching frames at a consistent offset.'
      ]
    }
  };
}

function createContainedClipFile({
  id,
  role,
  fingerprint,
  isShortFile,
  analysis
}: {
  id: string;
  role: 'source' | 'candidate';
  fingerprint: VisualFingerprint;
  isShortFile: boolean;
  analysis: ContainedClipAnalysis;
}) {
  return {
    id,
    role,
    filePath: fingerprint.filePath,
    fileName: fingerprint.fileName || basename(fingerprint.filePath),
    directory: fingerprint.directory || dirname(fingerprint.filePath),
    durationSeconds: fingerprint.durationSeconds,
    width: fingerprint.width,
    height: fingerprint.height,
    sizeBytes: fingerprint.sizeBytes,
    modifiedAtMs: fingerprint.modifiedTimeMs,
    matchedStartSeconds: isShortFile ? analysis.shortStartSeconds : analysis.longStartSeconds,
    matchedEndSeconds: isShortFile ? analysis.shortEndSeconds : analysis.longEndSeconds,
    reviewStatus: role === 'candidate' ? 'unreviewed' as const : undefined
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

function getMatchedDurationSeconds(
  matches: ContainedClipSampleMatch[],
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
    last(matches)!.shortTimeSeconds - first(matches)!.shortTimeSeconds + sampleIntervalSeconds
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

function getFingerprint(
  fingerprintsByPath: Map<string, VisualFingerprint>,
  filePath: string
): VisualFingerprint | undefined {
  return fingerprintsByPath.get(filePath) ?? fingerprintsByPath.get(normalizePathForComparison(filePath));
}

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
    const error = new Error('Contained-clip matching canceled.');
    error.name = 'AbortError';
    throw error;
  }
}
