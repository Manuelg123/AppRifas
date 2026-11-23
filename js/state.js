const STORAGE_KEY = 'rifasync_prototype_v1';

export function loadDb() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
}

export function saveDb(db) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}