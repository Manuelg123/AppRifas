import { getRangeList, getPairedLabel } from './pairs.js';
import {
  createRaffleInCloud,
  getRaffleOnce,
  subscribeToRaffle,
  updateRaffleInCloud
} from './state.js';

let currentRaffle = null;
let activeRaffleId = null;
let activeVendor = '';
let currentFilter = 'all';
let selectedLabel = null;
let unsubscribeRaffle = null;

function showToast(msg) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2200);
}

function normalizeRaffleData(raffle) {
  if (!raffle) return null;
  raffle.rangeKey = raffle.rangeKey || '1-100';
  raffle.rangeCfg = getRangeList(raffle.rangeKey);
  raffle.mode = Number(raffle.mode) === 2 ? 2 : 1;
  raffle.price = Number(raffle.price) || 1;

  if (!raffle.numbers || typeof raffle.numbers !== 'object') {
    raffle.numbers = {};
  }

  raffle.rangeCfg.list.forEach(n => {
    if (!raffle.numbers[n.label]) {
      raffle.numbers[n.label] = {
        status: 'libre',
        ticketId: null,
        pair: raffle.mode === 2 ? getPairedLabel(n, raffle.rangeCfg) : null
      };
    }
  });

  if (!raffle.tickets || typeof raffle.tickets !== 'object') {
    raffle.tickets = {};
  }
  return raffle;
}

async function saveNewRaffleWithRetry(code, data, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await createRaffleInCloud(code, data);
      return;
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise(res => setTimeout(res, 700));
    }
  }
}

async function createRaffle() {
  const title = document.getElementById('rifaTitle').value.trim() || 'Rifa sin título';
  const rangeKey = document.getElementById('rifaRange').value;
  const mode = Number(document.getElementById('rifaMode').value);
  const price = Number(document.getElementById('rifaPrice').value) || 1;
  const vendor = document.getElementById('creatorName').value.trim() || 'Organizador';

  const btnCreate = document.getElementById('btnCreateRaffle');
  btnCreate.disabled = true;
  btnCreate.textContent = 'Subiendo talonario...';

  try {
    let code = 'RIFA-' + Math.floor(100 + Math.random() * 900);
    const existing = await getRaffleOnce(code).catch(() => null);
    if (existing) {
      code = 'RIFA-' + Math.floor(1000 + Math.random() * 9000);
    }

    const rangeCfg = getRangeList(rangeKey);
    const numbers = {};

    rangeCfg.list.forEach(n => {
      numbers[n.label] = {
        status: 'libre',
        ticketId: null,
        pair: mode === 2 ? getPairedLabel(n, rangeCfg) : null
      };
    });

    const raffleData = {
      id: code,
      title,
      rangeKey,
      mode,
      price,
      createdAt: new Date().toISOString(),
      numbers,
      tickets: {}
    };

    await saveNewRaffleWithRetry(code, raffleData, 3);
    currentRaffle = normalizeRaffleData(raffleData);
    openBoard(code, vendor);
    showToast(`Rifa ${code} guardada en la nube`);
  } catch (err) {
    console.error('Error al subir talonario:', err);
    alert('No se pudo subir el talonario nuevo a Firebase. Revisa tu conexión e intenta de nuevo.');
  } finally {
    btnCreate.disabled = false;
    btnCreate.textContent = 'Crear y abrir talonario';
  }
}

async function joinRaffle() {
  const code = document.getElementById('joinCode').value.trim().toUpperCase();
  const vendor = document.getElementById('joinVendor').value.trim() || 'Vendedor';

  if (!code) {
    alert('Escribe el código de la rifa (ej. RIFA-101).');
    return;
  }

  const btnJoin = document.getElementById('btnJoinRaffle');
  btnJoin.disabled = true;
  btnJoin.textContent = 'Buscando...';

  try {
    const raffle = await getRaffleOnce(code);
    if (!raffle) {
      alert('No se encontró una rifa con ese código.');
      return;
    }
    currentRaffle = normalizeRaffleData(raffle);
    openBoard(code, vendor);
  } catch (err) {
    console.error(err);
    alert('Error al buscar la rifa. Revisa tu conexión.');
  } finally {
    btnJoin.disabled = false;
    btnJoin.textContent = 'Entrar al talonario';
  }
}

function shareRaffleCode() {
  if (!activeRaffleId || !currentRaffle) return;
  const text = `Únete a vender la rifa "${currentRaffle.title}" en App Rifa.\nCódigo: ${currentRaffle.id}`;

  if (navigator.share) {
    navigator.share({ title: currentRaffle.title, text }).catch(() => {});
  } else if (navigator.clipboard) {