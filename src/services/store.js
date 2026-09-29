// In-memory copy of the data, persisted to localStorage so a refresh mid-demo
// keeps everything. Only services/api.js should import this file.

import { useSyncExternalStore } from 'react';
import { today } from '../lib/dates';
import { syncBedStatuses } from './logic';
import { createSampleData, SCHEMA } from './sampleData';

const KEY = 'pg-demo-data-v1';

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data && data.schema === SCHEMA ? data : null;
  } catch {
    return null;
  }
}

function persist(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Storage full or blocked (private mode). The demo still works for this session.
  }
}

let state = load() ?? createSampleData(today());
let version = 0;
const listeners = new Set();

export const getState = () => state;

function emit() {
  version += 1;
  listeners.forEach((l) => l());
}

/**
 * Apply a change to a copy of the data. If the mutator throws, nothing changes.
 */
export function commit(mutator) {
  const next = structuredClone(state);
  const result = mutator(next);
  syncBedStatuses(next);
  state = next;
  persist(state);
  emit();
  return result;
}

export function replaceState(data) {
  state = data;
  syncBedStatuses(state);
  persist(state);
  emit();
}

const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Re-render when data changes, and return a fresh read. */
export function useData(read) {
  useSyncExternalStore(subscribe, () => version);
  return read();
}
