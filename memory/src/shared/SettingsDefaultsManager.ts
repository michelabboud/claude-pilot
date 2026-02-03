/**
 * SettingsDefaultsManager
 *
 * Single source of truth for all default configuration values.
 * Provides methods to get defaults with optional environment variable overrides.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { DEFAULT_OBSERVATION_TYPES_STRING, DEFAULT_OBSERVATION_CONCEPTS_STRING } from '../constants/observation-metadata.js';
// NOTE: Do NOT import logger here - it creates a circular dependency

export interface SettingsDefaults {
  CLAUDE_MEM_MODEL: string;
  CLAUDE_MEM_CONTEXT_OBSERVATIONS: string;
  CLAUDE_MEM_WORKER_PORT: string;
  CLAUDE_MEM_WORKER_HOST: string;
  CLAUDE_MEM_WORKER_BIND: string;
  CLAUDE_MEM_SKIP_TOOLS: string;
  CLAUDE_MEM_PROVIDER: string;
  CLAUDE_MEM_GEMINI_API_KEY: string;
  CLAUDE_MEM_GEMINI_MODEL: string;
  CLAUDE_MEM_GEMINI_RATE_LIMITING_ENABLED: boolean;
  CLAUDE_MEM_OPENROUTER_API_KEY: string;
  CLAUDE_MEM_OPENROUTER_MODEL: string;
  CLAUDE_MEM_OPENROUTER_SITE_URL: string;
  CLAUDE_MEM_OPENROUTER_APP_NAME: string;
  CLAUDE_MEM_OPENROUTER_MAX_CONTEXT_MESSAGES: string;
  CLAUDE_MEM_OPENROUTER_MAX_TOKENS: string;
  CLAUDE_MEM_MISTRAL_API_KEY: string;
  CLAUDE_MEM_MISTRAL_MODEL: string;
  CLAUDE_MEM_OPENAI_API_KEY: string;
  CLAUDE_MEM_OPENAI_MODEL: string;
  CLAUDE_MEM_OPENAI_BASE_URL: string;
  CLAUDE_MEM_DATA_DIR: string;
  CLAUDE_MEM_LOG_LEVEL: string;
  CLAUDE_MEM_PYTHON_VERSION: string;
  CLAUDE_CODE_PATH: string;
  CLAUDE_MEM_MODE: string;
  CLAUDE_MEM_CONTEXT_SHOW_READ_TOKENS: boolean;
  CLAUDE_MEM_CONTEXT_SHOW_WORK_TOKENS: boolean;
  CLAUDE_MEM_CONTEXT_SHOW_SAVINGS_AMOUNT: boolean;
  CLAUDE_MEM_CONTEXT_SHOW_SAVINGS_PERCENT: boolean;
  CLAUDE_MEM_CONTEXT_OBSERVATION_TYPES: string;
  CLAUDE_MEM_CONTEXT_OBSERVATION_CONCEPTS: string;
  CLAUDE_MEM_CONTEXT_FULL_COUNT: string;
  CLAUDE_MEM_CONTEXT_FULL_FIELD: string;
  CLAUDE_MEM_CONTEXT_SESSION_COUNT: string;
  CLAUDE_MEM_CONTEXT_SHOW_LAST_SUMMARY: boolean;
  CLAUDE_MEM_CONTEXT_SHOW_LAST_MESSAGE: boolean;
  CLAUDE_MEM_FOLDER_CLAUDEMD_ENABLED: boolean;
  CLAUDE_MEM_FOLDER_MD_EXCLUDE: string;
  CLAUDE_MEM_CHROMA_ENABLED: boolean;
  CLAUDE_MEM_VECTOR_DB: string;
  CLAUDE_MEM_EMBEDDING_MODEL: string;
  CLAUDE_MEM_EXCLUDE_PROJECTS: string;
  CLAUDE_MEM_REMOTE_MODE: boolean;
  CLAUDE_MEM_REMOTE_URL: string;         // Remote worker URL (e.g., "https://claude-mem.example.com")
  CLAUDE_MEM_REMOTE_TOKEN: string;
  CLAUDE_MEM_REMOTE_VERIFY_SSL: boolean;
  CLAUDE_MEM_REMOTE_TIMEOUT_MS: string;
  CLAUDE_MEM_RETENTION_ENABLED: boolean;
  CLAUDE_MEM_RETENTION_MAX_AGE_DAYS: string;
  CLAUDE_MEM_RETENTION_MAX_COUNT: string;
  CLAUDE_MEM_RETENTION_EXCLUDE_TYPES: string;
  CLAUDE_MEM_RETENTION_SOFT_DELETE: boolean;
  CLAUDE_MEM_BATCH_SIZE: string;
}

export class SettingsDefaultsManager {
  /**
   * Default values for all settings
   */
  private static readonly DEFAULTS: SettingsDefaults = {
    CLAUDE_MEM_MODEL: 'haiku',
    CLAUDE_MEM_CONTEXT_OBSERVATIONS: '50',
    CLAUDE_MEM_WORKER_PORT: '37777',
    CLAUDE_MEM_WORKER_HOST: '127.0.0.1',
    CLAUDE_MEM_WORKER_BIND: '127.0.0.1',
    CLAUDE_MEM_SKIP_TOOLS: 'ListMcpResourcesTool,SlashCommand,Skill,TodoWrite,AskUserQuestion',
    CLAUDE_MEM_PROVIDER: 'claude',
    CLAUDE_MEM_GEMINI_API_KEY: '',
    CLAUDE_MEM_GEMINI_MODEL: 'gemini-2.5-flash-lite',
    CLAUDE_MEM_GEMINI_RATE_LIMITING_ENABLED: true,
    CLAUDE_MEM_OPENROUTER_API_KEY: '',
    CLAUDE_MEM_OPENROUTER_MODEL: 'xiaomi/mimo-v2-flash:free',
    CLAUDE_MEM_OPENROUTER_SITE_URL: '',
    CLAUDE_MEM_OPENROUTER_APP_NAME: 'claude-mem',
    CLAUDE_MEM_OPENROUTER_MAX_CONTEXT_MESSAGES: '20',
    CLAUDE_MEM_OPENROUTER_MAX_TOKENS: '100000',
    CLAUDE_MEM_MISTRAL_API_KEY: '',
    CLAUDE_MEM_MISTRAL_MODEL: 'mistral-small-latest',
    CLAUDE_MEM_OPENAI_API_KEY: '',
    CLAUDE_MEM_OPENAI_MODEL: 'gpt-4o-mini',
    CLAUDE_MEM_OPENAI_BASE_URL: '',
    CLAUDE_MEM_DATA_DIR: join(homedir(), '.claude-mem'),
    CLAUDE_MEM_LOG_LEVEL: 'INFO',
    CLAUDE_MEM_PYTHON_VERSION: '3.12',
    CLAUDE_CODE_PATH: '',
    CLAUDE_MEM_MODE: 'code',
    CLAUDE_MEM_CONTEXT_SHOW_READ_TOKENS: false,
    CLAUDE_MEM_CONTEXT_SHOW_WORK_TOKENS: false,
    CLAUDE_MEM_CONTEXT_SHOW_SAVINGS_AMOUNT: false,
    CLAUDE_MEM_CONTEXT_SHOW_SAVINGS_PERCENT: false,
    CLAUDE_MEM_CONTEXT_OBSERVATION_TYPES: DEFAULT_OBSERVATION_TYPES_STRING,
    CLAUDE_MEM_CONTEXT_OBSERVATION_CONCEPTS: DEFAULT_OBSERVATION_CONCEPTS_STRING,
    CLAUDE_MEM_CONTEXT_FULL_COUNT: '10',
    CLAUDE_MEM_CONTEXT_FULL_FIELD: 'facts',
    CLAUDE_MEM_CONTEXT_SESSION_COUNT: '10',
    CLAUDE_MEM_CONTEXT_SHOW_LAST_SUMMARY: true,
    CLAUDE_MEM_CONTEXT_SHOW_LAST_MESSAGE: true,
    CLAUDE_MEM_FOLDER_CLAUDEMD_ENABLED: false,
    CLAUDE_MEM_FOLDER_MD_EXCLUDE: '[]',
    CLAUDE_MEM_CHROMA_ENABLED: true,
    CLAUDE_MEM_VECTOR_DB: 'chroma',
    CLAUDE_MEM_EMBEDDING_MODEL: 'Xenova/all-MiniLM-L6-v2',
    CLAUDE_MEM_EXCLUDE_PROJECTS: '[]',
    CLAUDE_MEM_REMOTE_MODE: false,
    CLAUDE_MEM_REMOTE_URL: '',
    CLAUDE_MEM_REMOTE_TOKEN: '',
    CLAUDE_MEM_REMOTE_VERIFY_SSL: true,
    CLAUDE_MEM_REMOTE_TIMEOUT_MS: '30000',
    CLAUDE_MEM_RETENTION_ENABLED: true,
    CLAUDE_MEM_RETENTION_MAX_AGE_DAYS: '31',
    CLAUDE_MEM_RETENTION_MAX_COUNT: '1000',
    CLAUDE_MEM_RETENTION_EXCLUDE_TYPES: '["summary"]',
    CLAUDE_MEM_RETENTION_SOFT_DELETE: false,
    CLAUDE_MEM_BATCH_SIZE: '5',
  };

  /**
   * Get all defaults as an object
   */
  static getAllDefaults(): SettingsDefaults {
    return { ...this.DEFAULTS };
  }

  /**
   * Get a default value from defaults (no environment variable override)
   * Note: Use getBool() for boolean settings, this method is for string settings
   */
  static get(key: keyof SettingsDefaults): string {
    return this.DEFAULTS[key] as string;
  }

  /**
   * Get an integer default value
   */
  static getInt(key: keyof SettingsDefaults): number {
    const value = this.get(key);
    return parseInt(value, 10);
  }

  /**
   * Get a boolean default value
   */
  static getBool(key: keyof SettingsDefaults): boolean {
    const value = this.get(key);
    return value === 'true';
  }

  /**
   * Load settings from file with fallback to defaults
   * Returns merged settings with defaults as fallback
   * Handles all errors (missing file, corrupted JSON, permissions) by returning defaults
   */
  static loadFromFile(settingsPath: string): SettingsDefaults {
    try {
      if (!existsSync(settingsPath)) {
        const defaults = this.getAllDefaults();
        try {
          const dir = dirname(settingsPath);
          if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
          }
          writeFileSync(settingsPath, JSON.stringify(defaults, null, 2), 'utf-8');
          console.log('[SETTINGS] Created settings file with defaults:', settingsPath);
        } catch (error) {
          console.warn('[SETTINGS] Failed to create settings file, using in-memory defaults:', settingsPath, error);
        }
        return defaults;
      }

      const settingsData = readFileSync(settingsPath, 'utf-8');
      const settings = JSON.parse(settingsData);

      let flatSettings = settings;
      if (settings.env && typeof settings.env === 'object') {
        flatSettings = settings.env;

        try {
          writeFileSync(settingsPath, JSON.stringify(flatSettings, null, 2), 'utf-8');
          console.log('[SETTINGS] Migrated settings file from nested to flat schema:', settingsPath);
        } catch (error) {
          console.warn('[SETTINGS] Failed to auto-migrate settings file:', settingsPath, error);
        }
      }

      const BOOLEAN_SETTINGS: Array<keyof SettingsDefaults> = [
        'CLAUDE_MEM_GEMINI_RATE_LIMITING_ENABLED',
        'CLAUDE_MEM_CONTEXT_SHOW_READ_TOKENS',
        'CLAUDE_MEM_CONTEXT_SHOW_WORK_TOKENS',
        'CLAUDE_MEM_CONTEXT_SHOW_SAVINGS_AMOUNT',
        'CLAUDE_MEM_CONTEXT_SHOW_SAVINGS_PERCENT',
        'CLAUDE_MEM_CONTEXT_SHOW_LAST_SUMMARY',
        'CLAUDE_MEM_CONTEXT_SHOW_LAST_MESSAGE',
        'CLAUDE_MEM_FOLDER_CLAUDEMD_ENABLED',
        'CLAUDE_MEM_CHROMA_ENABLED',
        'CLAUDE_MEM_REMOTE_MODE',
        'CLAUDE_MEM_REMOTE_VERIFY_SSL',
        'CLAUDE_MEM_RETENTION_ENABLED',
        'CLAUDE_MEM_RETENTION_SOFT_DELETE',
      ];

      const result: SettingsDefaults = { ...this.DEFAULTS };
      let needsMigration = false;

      for (const key of Object.keys(this.DEFAULTS) as Array<keyof SettingsDefaults>) {
        if (flatSettings[key] !== undefined) {
          if (BOOLEAN_SETTINGS.includes(key)) {
            const value = flatSettings[key];
            if (typeof value === 'string') {
              (result as unknown as Record<string, unknown>)[key] = value === 'true';
              needsMigration = true;
            } else {
              (result as unknown as Record<string, unknown>)[key] = value;
            }
          } else {
            (result as unknown as Record<string, unknown>)[key] = flatSettings[key];
          }
        }
      }

      if (needsMigration) {
        try {
          writeFileSync(settingsPath, JSON.stringify(result, null, 2), 'utf-8');
          console.log('[SETTINGS] Migrated boolean settings from strings to actual booleans:', settingsPath);
        } catch (error) {
          console.warn('[SETTINGS] Failed to auto-migrate boolean settings:', settingsPath, error);
        }
      }

      return result;
    } catch (error) {
      console.warn('[SETTINGS] Failed to load settings, using defaults:', settingsPath, error);
      return this.getAllDefaults();
    }
  }
}
