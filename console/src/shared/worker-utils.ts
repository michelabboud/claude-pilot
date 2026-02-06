import path from "path";
import { SettingsDefaultsManager } from "./SettingsDefaultsManager.js";

let cachedPort: number | null = null;
let cachedHost: string | null = null;
let cachedBind: string | null = null;

/**
 * Get the worker port number from settings
 * Uses CLAUDE_PILOT_WORKER_PORT from settings file or default (41777)
 * Caches the port value to avoid repeated file reads
 */
export function getWorkerPort(): number {
  if (cachedPort !== null) {
    return cachedPort;
  }

  const settingsPath = path.join(SettingsDefaultsManager.get("CLAUDE_PILOT_DATA_DIR"), "settings.json");
  const settings = SettingsDefaultsManager.loadFromFile(settingsPath);
  cachedPort = parseInt(settings.CLAUDE_PILOT_WORKER_PORT, 10);
  return cachedPort;
}

/**
 * Get the worker host address (for client connections)
 * Uses CLAUDE_PILOT_WORKER_HOST from settings file or default (127.0.0.1)
 * Caches the host value to avoid repeated file reads
 */
export function getWorkerHost(): string {
  if (cachedHost !== null) {
    return cachedHost;
  }

  const settingsPath = path.join(SettingsDefaultsManager.get("CLAUDE_PILOT_DATA_DIR"), "settings.json");
  const settings = SettingsDefaultsManager.loadFromFile(settingsPath);
  cachedHost = settings.CLAUDE_PILOT_WORKER_HOST;
  return cachedHost;
}

/**
 * Get the worker bind address (for server listening)
 * Uses CLAUDE_PILOT_WORKER_BIND from settings file or default (127.0.0.1)
 * Set to 0.0.0.0 to allow network access from other machines
 * Caches the bind value to avoid repeated file reads
 */
export function getWorkerBind(): string {
  if (cachedBind !== null) {
    return cachedBind;
  }

  const settingsPath = path.join(SettingsDefaultsManager.get("CLAUDE_PILOT_DATA_DIR"), "settings.json");
  const settings = SettingsDefaultsManager.loadFromFile(settingsPath);
  cachedBind = settings.CLAUDE_PILOT_WORKER_BIND;
  return cachedBind;
}

/**
 * Format host for URL (handles IPv6 addresses correctly)
 * IPv6 addresses need to be wrapped in brackets: [::1]
 */
function formatHostForUrl(host: string): string {
  if (host.includes(":") && !host.startsWith("[")) {
    return `[${host}]`;
  }
  return host;
}

/**
 * Get the worker base URL (protocol + host + port)
 * Handles IPv6 addresses correctly by wrapping them in brackets
 * Example: http://127.0.0.1:41777 or http://[::1]:41777
 */
export function getWorkerBaseUrl(): string {
  const host = getWorkerHost();
  const port = getWorkerPort();
  return `http://${formatHostForUrl(host)}:${port}`;
}


