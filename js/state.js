import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getDatabase,
  ref,
  set,
  get,
  onValue
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';
import { firebaseConfig } from './firebase-config.js';

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export async function createRaffleInCloud(code, raffleData) {
  await set(ref(db, `raffles/${code}`), raffleData);
}

export async function getRaffleOnce(code) {
  const snapshot = await get(ref(db, `raffles/${code}`));
  return snapshot.exists() ? snapshot.val() : null;
}

export function subscribeToRaffle(code, callback) {
  const raffleRef = ref(db, `raffles/${code}`);
  return onValue(raffleRef, (snapshot) => {
    callback(snapshot.exists() ? snapshot.val() : null);
  });
}

export async function updateRaffleInCloud(code, raffleData) {
  await set(ref(db, `raffles/${code}`), raffleData);
}