/**
 * Worker Configuration Types
 *
 * Type definitions for worker endpoint connections.
 */

/**
 * Resolved worker endpoint configuration
 * Used by hooks and services for API calls
 */
export interface WorkerEndpointConfig {
  /** The worker mode */
  mode: "local";
  /** Base URL to use for API calls */
  baseUrl: string;
  /** Auth headers to include in requests */
  authHeaders: Record<string, string>;
  /** Request timeout in milliseconds */
  timeoutMs: number;
  /** Whether SSL should be verified */
  verifySsl: boolean;
}
