import type { ReactElement } from 'react';
import { Button } from 'primereact/button';
import { Message } from 'primereact/message';
import type { PremiereStatusResponse } from '../../shared/types/premiere';

interface PremiereStatusBannerProps {
  isLoading: boolean;
  status: PremiereStatusResponse | null;
  error: string | null;
  onRefresh: () => void;
}

export function PremiereStatusBanner({
  isLoading,
  status,
  error,
  onRefresh
}: PremiereStatusBannerProps): ReactElement {
  const severity = getStatusSeverity(status, error);

  return (
    <section className="premiere-status-banner" aria-label="Premiere status">
      <Message
        severity={severity}
        content={
          <div className="premiere-status-content">
            <div>
              <strong>{getStatusTitle(status, error, isLoading)}</strong>
              <span>{getStatusDetail(status, error)}</span>
            </div>
            <Button
              label="Retry"
              icon="pi pi-refresh"
              severity="secondary"
              outlined
              loading={isLoading}
              onClick={onRefresh}
            />
          </div>
        }
      />
    </section>
  );
}

function getStatusSeverity(
  status: PremiereStatusResponse | null,
  error: string | null
): 'success' | 'info' | 'warn' | 'error' {
  if (error || status?.status === 'error') {
    return 'error';
  }

  if (status?.status === 'ready') {
    return 'success';
  }

  if (!status) {
    return 'info';
  }

  return 'warn';
}

function getStatusTitle(
  status: PremiereStatusResponse | null,
  error: string | null,
  isLoading: boolean
): string {
  if (isLoading && !status) {
    return 'Checking Premiere bridge';
  }

  if (error) {
    return 'Premiere status failed';
  }

  if (status?.status === 'ready') {
    return 'Premiere bridge ready';
  }

  if (status?.status === 'premiere_not_running') {
    return 'Premiere Pro is not open';
  }

  if (status?.status === 'bridge_disconnected') {
    return 'Premiere bridge disconnected';
  }

  return 'Premiere status unavailable';
}

function getStatusDetail(status: PremiereStatusResponse | null, error: string | null): string {
  if (error) {
    return error;
  }

  if (!status) {
    return 'Open Premiere Pro and load the Collie Video bridge plugin before editing selected videos.';
  }

  if (status.status === 'ready') {
    const projectName = status.bridge?.activeProjectName;
    return projectName
      ? `Connected to ${projectName}.`
      : 'Selected videos can be imported into the open Premiere project.';
  }

  return status.message || 'Unable to check Premiere bridge status.';
}
