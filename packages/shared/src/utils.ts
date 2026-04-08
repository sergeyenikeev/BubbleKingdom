import type { LanguageCode } from "./types";

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function sum(values: number[]): number {
  return values.reduce((accumulator, value) => accumulator + value, 0);
}

export function createId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function deepMerge<T extends Record<string, unknown>>(base: T, patch: Partial<T>): T {
  const result: Record<string, unknown> = { ...base };

  for (const [key, value] of Object.entries(patch)) {
    if (
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value) &&
      typeof result[key] === "object" &&
      result[key] !== null &&
      !Array.isArray(result[key])
    ) {
      result[key] = deepMerge(
        result[key] as Record<string, unknown>,
        value as Record<string, unknown>,
      );
      continue;
    }

    result[key] = value as unknown;
  }

  return result as T;
}

export function safeJsonParse<T>(value: string | null): T | null {
  if (value === null) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function normalizeLanguage(value: string | undefined | null): LanguageCode {
  if (value?.toLowerCase().startsWith("ru")) {
    return "ru";
  }

  return "en";
}

export class TinyEmitter<TEvent extends Record<string, unknown>> {
  private readonly listeners = new Map<keyof TEvent, Set<(payload: unknown) => void>>();

  on<TKey extends keyof TEvent>(event: TKey, listener: (payload: TEvent[TKey]) => void): () => void {
    const current = this.listeners.get(event) ?? new Set();
    current.add(listener as (payload: unknown) => void);
    this.listeners.set(event, current);

    return () => {
      current.delete(listener as (payload: unknown) => void);
    };
  }

  emit<TKey extends keyof TEvent>(event: TKey, payload: TEvent[TKey]): void {
    const current = this.listeners.get(event);
    if (!current) {
      return;
    }

    for (const listener of current) {
      listener(payload);
    }
  }
}
