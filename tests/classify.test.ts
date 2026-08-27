import { describe, expect, it } from 'vitest';
import { classifyProbe, classLabel, isReachable } from '../src/classify.js';

describe('classifyProbe', () => {
  it('marks 2xx as ok', () => {
    expect(classifyProbe({ status: 200 })).toBe('ok');
    expect(classifyProbe({ status: 204 })).toBe('ok');
  });

  it('marks 401/403 as ok (reachable)', () => {
    expect(classifyProbe({ status: 401 })).toBe('ok');
    expect(classifyProbe({ status: 403 })).toBe('ok');
  });

  it('marks other HTTP statuses as http_N', () => {
    expect(classifyProbe({ status: 404 })).toBe('http_404');
    expect(classifyProbe({ status: 502 })).toBe('http_502');
  });

  it('detects DNS failures', () => {
    expect(classifyProbe({ errorMessage: 'getaddrinfo ENOTFOUND api.example.com' })).toBe('dns');
    expect(classifyProbe({ errorMessage: 'Error: ERR_NAME_NOT_RESOLVED' })).toBe('dns');
  });

  it('detects TLS failures', () => {
    expect(classifyProbe({ errorMessage: 'unable to verify the first certificate' })).toBe('tls');
    expect(classifyProbe({ errorMessage: 'SSL alert handshake failure' })).toBe('tls');
  });

  it('detects timeouts', () => {
    expect(classifyProbe({ timedOut: true })).toBe('timeout');
    expect(classifyProbe({ errorMessage: 'The operation was aborted due to timeout' })).toBe(
      'timeout',
    );
    expect(classifyProbe({ errorMessage: 'Connect Timeout Error' })).toBe('timeout');
  });

  it('falls back to error', () => {
    expect(classifyProbe({ errorMessage: 'ECONNREFUSED 127.0.0.1:9' })).toBe('error');
  });
});

describe('isReachable / classLabel', () => {
  it('isReachable for ok and any HTTP status', () => {
    expect(isReachable('ok')).toBe(true);
    expect(isReachable('http_500')).toBe(true);
    expect(isReachable('timeout')).toBe(false);
    expect(isReachable('dns')).toBe(false);
  });

  it('labels classes', () => {
    expect(classLabel('ok')).toBe('OK');
    expect(classLabel('dns')).toBe('DNS fail');
    expect(classLabel('http_502')).toBe('HTTP_502');
  });
});
