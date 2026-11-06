// Presets: 4 named slots of saved settings. Storage is passed in (localStorage in the
// app, a fake in tests). Slots are kept in memory too, so presets still work for the
// session if storage is missing or failing; they just don't survive a reload.
import { normalizeSettings } from './settings.js';

// Kept from the project's first name, so presets saved before the rename still load.
export const STORAGE_KEY = 'ambient-toy.presets';
export const SLOT_COUNT = 4;
export const NAME_MAX = 24;

// Stored as { version, slots: [ { name, settings } | null, ... ] }. Settings hold
// names like "dorian", never list positions, so reordering a table can't break them.
// Returns { slots, readable }: readable is false if storage is missing or throws.
function read(storage) {
  const empty = Array(SLOT_COUNT).fill(null);
  let raw;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return { slots: empty, readable: false };
  }
  try {
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.slots)) return { slots: empty, readable: true };
    const slots = empty.map((_, i) => {
      const slot = data.slots[i];
      if (!slot || typeof slot !== 'object' || typeof slot.name !== 'string') return null;
      return { name: slot.name, settings: normalizeSettings(slot.settings) };
    });
    return { slots, readable: true };
  } catch {
    return { slots: empty, readable: true }; // damaged JSON
  }
}

function cleanName(name, index) {
  const trimmed = typeof name === 'string' ? name.trim().slice(0, NAME_MAX).trim() : '';
  return trimmed || `Preset ${index + 1}`;
}

export function createPresetStore(storage) {
  const { slots, readable } = read(storage);
  // Nothing is written until the first save, so damaged or newer data is never
  // overwritten just by opening the page. A failed write turns this off.
  let persistent = readable;

  function write() {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, slots }));
      return true;
    } catch {
      return false;
    }
  }

  return {
    get persistent() { return persistent; },

    // [{ name, settings } | null] x 4, as copies.
    list() {
      return slots.map(s => (s ? { name: s.name, settings: { ...s.settings } } : null));
    },

    needsConfirm(index) {
      return slots[index] != null;
    },

    // Returns true if the preset was written to storage.
    save(index, name, settings) {
      slots[index] = { name: cleanName(name, index), settings: normalizeSettings(settings) };
      persistent = storage != null && write();
      return persistent;
    },

    // A fresh, valid settings object, or null for an empty slot.
    load(index) {
      return slots[index] ? { ...slots[index].settings } : null;
    },
  };
}
