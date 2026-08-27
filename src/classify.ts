/** Result classification for a single probe attempt. */
export type ProbeClass =
  | 'ok'
  | 'dns'
  | 'tls'
  | 'timeout'
  | `http_${number}`
  | 'error';

export interface ClassifyInput {
  /** HTTP status if a response was received */
  status?: number;
  /** Error message / code from the fetch failure */
  errorMessage?: string;
  /** Abort / timeout fired */
  timedOut?: boolean;
}

/**
 * Classify a probe outcome.
 * 401/403 count as reachable (API is up; auth not our concern).
 */
export function classifyProbe(input: ClassifyInput): ProbeClass {
  if (input.timedOut) return 'timeout';

  if (typeof input.status === 'number') {
    if (input.status === 401 || input.status === 403) return 'ok';
    if (input.status >= 200 && input.status < 400) return 'ok';
    return `http_${input.status}`;
  }

  const msg = (input.errorMessage ?? '').toLowerCase();

  if (
    msg.includes('enotfound') ||
    msg.includes('getaddrinfo') ||
    msg.includes('dns') ||
    msg.includes('err_name_not_resolved')
  ) {
    return 'dns';
  }

  if (
    msg.includes('cert') ||
    msg.includes('ssl') ||
    msg.includes('tls') ||
    msg.includes('unable to verify') ||
    msg.includes('err_tls') ||
    msg.includes('certificate')
  ) {
    return 'tls';
  }

  if (
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('aborted') ||
    msg.includes('abort_err') ||
    msg.includes('und_err_connect_timeout') ||
    msg.includes('headers timeout') ||
    msg.includes('body timeout')
  ) {
    return 'timeout';
  }

  return 'error';
}

/** True when the endpoint is considered reachable for diagnostics. */
export function isReachable(cls: ProbeClass): boolean {
  return cls === 'ok' || cls.startsWith('http_');
}

/** Short human label for a class. */
export function classLabel(cls: ProbeClass): string {
  switch (cls) {
    case 'ok':
      return 'OK';
    case 'dns':
      return 'DNS fail';
    case 'tls':
      return 'TLS fail';
    case 'timeout':
      return 'Timeout';
    case 'error':
      return 'Error';
    default:
      if (cls.startsWith('http_')) return cls.toUpperCase();
      return cls;
  }
}
