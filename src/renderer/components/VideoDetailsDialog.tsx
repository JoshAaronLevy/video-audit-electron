import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { Message } from 'primereact/message';
import { ProgressBar } from 'primereact/progressbar';
import { Tag } from 'primereact/tag';
import type { PreviewClipJobSnapshot } from '../../shared/types/mediaPreview';
import type { VideoPreviewFrame, VideoRow } from '../../shared/types/video';

interface VideoDetailsDialogProps {
  visible: boolean;
  video: VideoRow | null;
  previewClipProgress: PreviewClipJobSnapshot | null;
  previewClipPercent: number | null;
  previewClipError: string | null;
  isPreviewClipActive: boolean;
  onGeneratePreviewClips: (video: VideoRow, frames: VideoPreviewFrame[]) => void;
  onCancelPreviewClips: () => void;
  onRevealPath: (path: string) => void;
  onHide: () => void;
}

export function VideoDetailsDialog({
  visible,
  video,
  previewClipProgress,
  previewClipPercent,
  previewClipError,
  isPreviewClipActive,
  onGeneratePreviewClips,
  onCancelPreviewClips,
  onRevealPath,
  onHide
}: VideoDetailsDialogProps): ReactElement {
  const frames = useMemo(() => getDisplayPreviewFrames(video), [video]);
  const [selectedFrameKey, setSelectedFrameKey] = useState<string | null>(null);
  const [isPreviewHovered, setIsPreviewHovered] = useState(false);
  const [isPreviewPinned, setIsPreviewPinned] = useState(false);

  useEffect(() => {
    setSelectedFrameKey(frames[0] ? getPreviewFrameKey(frames[0]) : null);
    setIsPreviewHovered(false);
    setIsPreviewPinned(false);
  }, [frames, video?.path]);

  const selectedFrame =
    frames.find((frame) => getPreviewFrameKey(frame) === selectedFrameKey) ?? frames[0] ?? null;
  const selectedClip = selectedFrame?.previewClip;
  const clipUrl = selectedClip?.generated && selectedClip.status !== 'failed' ? selectedClip.url : null;
  const thumbnailUrl = selectedFrame?.thumbnail.url ?? video?.thumbnail?.url ?? null;
  const shouldPlayClip = Boolean(clipUrl && (isPreviewHovered || isPreviewPinned));
  const readyClipCount = frames.filter(hasReadyPreviewClip).length;
  const missingClipCount = frames.length - readyClipCount;
  const canGenerateClips = Boolean(video) && !isPreviewClipActive;
  const progressMessage = previewClipProgress?.message ?? null;

  return (
    <Dialog
      header={video?.fileName ?? 'Video Details'}
      visible={visible}
      modal
      className="video-details-dialog"
      onHide={onHide}
    >
      {video ? (
        <div className="video-details-content">
          <section className="video-details-main" aria-label="Video preview">
            <div
              className="detail-preview-stage"
              onMouseEnter={() => setIsPreviewHovered(true)}
              onMouseLeave={() => setIsPreviewHovered(false)}
              onClick={() => {
                if (clipUrl) {
                  setIsPreviewPinned((current) => !current);
                }
              }}
            >
              {clipUrl && shouldPlayClip ? (
                <video
                  key={`${clipUrl}-${String(isPreviewPinned)}`}
                  src={clipUrl}
                  className="detail-preview-media"
                  autoPlay
                  muted
                  loop
                  playsInline
                />
              ) : thumbnailUrl ? (
                <img className="detail-preview-media" src={thumbnailUrl} alt={`Preview for ${video.fileName}`} />
              ) : (
                <div className="detail-preview-empty">No Preview</div>
              )}
              <Tag
                className="detail-preview-status"
                value={clipUrl ? (isPreviewPinned ? 'Pinned' : 'Clip Ready') : 'Clip Missing'}
                severity={clipUrl ? 'success' : 'secondary'}
              />
            </div>

            <div className="video-detail-facts">
              <InfoRow label="File" value={video.displayFile || video.fileName} />
              <InfoRow label="Folder" value={video.displayDirectory || video.directory} />
              <InfoRow label="Resolution" value={video.resolution || 'Unknown'} />
              <InfoRow label="Duration" value={video.durationFormatted || 'Unknown'} />
              <InfoRow label="Aspect" value={video.displayAspectRatio || 'Unknown'} />
              <InfoRow label="Preview clips" value={`${readyClipCount}/${frames.length}`} />
              <Button
                label="Reveal"
                icon="pi pi-external-link"
                severity="secondary"
                outlined
                onClick={() => onRevealPath(video.path)}
              />
            </div>
          </section>

          <section className="preview-frame-carousel" aria-label="Preview frames">
            {frames.length > 0 ? (
              frames.map((frame) => {
                const frameKey = getPreviewFrameKey(frame);
                const isSelected = frameKey === selectedFrameKey;

                return (
                  <button
                    key={frameKey}
                    type="button"
                    className={`preview-frame-button${isSelected ? ' is-selected' : ''}`}
                    aria-pressed={isSelected}
                    onClick={() => {
                      setSelectedFrameKey(frameKey);
                      setIsPreviewHovered(false);
                      setIsPreviewPinned(false);
                    }}
                  >
                    {frame.thumbnail.url ? (
                      <img src={frame.thumbnail.url} alt={`Frame at ${frame.timestampLabel}`} />
                    ) : (
                      <span />
                    )}
                    <small>{frame.timestampLabel}</small>
                    <Tag
                      value={hasReadyPreviewClip(frame) ? 'Clip' : 'Still'}
                      severity={hasReadyPreviewClip(frame) ? 'success' : 'secondary'}
                    />
                  </button>
                );
              })
            ) : (
              <p className="empty-copy">No preview frames yet.</p>
            )}
          </section>

          <section className="preview-clip-actions" aria-label="Preview clip generation">
            {previewClipError ? <Message severity="error" text={previewClipError} /> : null}
            {progressMessage ? (
              <div className="preview-clip-progress">
                <ProgressBar value={previewClipPercent ?? 0} showValue={previewClipPercent !== null} />
                <p>{progressMessage}</p>
              </div>
            ) : null}
            <div className="dialog-actions">
              {isPreviewClipActive ? (
                <Button
                  label="Cancel"
                  icon="pi pi-times"
                  severity="secondary"
                  outlined
                  onClick={onCancelPreviewClips}
                />
              ) : null}
              <Button
                label={missingClipCount === 1 ? 'Generate Preview Clip' : 'Generate Preview Clips'}
                icon="pi pi-video"
                severity="info"
                loading={isPreviewClipActive}
                disabled={!canGenerateClips}
                onClick={() => onGeneratePreviewClips(video, frames)}
              />
            </div>
          </section>
        </div>
      ) : null}
    </Dialog>
  );
}

function getDisplayPreviewFrames(video: VideoRow | null): VideoPreviewFrame[] {
  if (!video) {
    return [];
  }

  const frames = (video.previewFrames ?? []).filter((frame) => frame.thumbnail.generated);

  if (frames.length > 0) {
    return frames;
  }

  if (!video.thumbnail?.generated) {
    return [];
  }

  const timestampSeconds = video.thumbnail.timestampSeconds ?? 0;

  return [
    {
      index: 0,
      batchId: 'poster',
      timestampSeconds,
      timestampLabel: formatTimestampLabel(timestampSeconds),
      thumbnail: video.thumbnail
    }
  ];
}

function hasReadyPreviewClip(frame: VideoPreviewFrame): boolean {
  return Boolean(frame.previewClip?.generated && frame.previewClip.status !== 'failed' && frame.previewClip.url);
}

function getPreviewFrameKey(frame: VideoPreviewFrame): string {
  return `${frame.batchId}:${frame.index}:${frame.timestampSeconds}`;
}

function formatTimestampLabel(timestampSeconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(Number(timestampSeconds) || 0));
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);
  const parts = hours > 0 ? [hours, minutes, seconds] : [minutes, seconds];

  return parts.map((part) => String(part).padStart(2, '0')).join(':');
}

function InfoRow({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div className="info-row">
      <dt>{label}</dt>
      <dd title={value}>{value}</dd>
    </div>
  );
}
