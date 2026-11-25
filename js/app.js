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
    navigator.clipboard.writeText(currentRaffle.id);
    showToast(`Código ${currentRaffle.id} copiado`);
  }
}

function openBoard(code, vendor) {
  activeRaffleId = code;
  activeVendor = vendor;
  currentFilter = 'all';

  if (unsubscribeRaffle) {
    unsubscribeRaffle();
    unsubscribeRaffle = null;
  }

  document.querySelectorAll('.chip').forEach(c => {
    c.classList.toggle('active', c.dataset.filter === 'all');
  });
  document.getElementById('searchNum').value = '';

  document.getElementById('viewHome').classList.add('hidden');
  document.getElementById('viewBoard').classList.remove('hidden');
  document.getElementById('headerInfo').textContent = `${code} · ${vendor}`;

  if (currentRaffle) {
    renderBoard();
  }

  unsubscribeRaffle = subscribeToRaffle(code, (data) => {
    if (!data || activeRaffleId !== code) return;
    currentRaffle = normalizeRaffleData(data);
    renderBoard();
  });
}

function goHome() {
  if (unsubscribeRaffle) {
    unsubscribeRaffle();
    unsubscribeRaffle = null;
  }
  activeRaffleId = null;
  currentRaffle = null;
  document.getElementById('viewBoard').classList.add('hidden');
  document.getElementById('viewHome').classList.remove('hidden');
  document.getElementById('headerInfo').textContent = 'En línea';
}

function setFilter(filter, el) {
  currentFilter = filter;
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  renderGrid();
}

function renderBoard() {
  if (!currentRaffle) return;
  document.getElementById('boardTitle').textContent = currentRaffle.title;
  document.getElementById('boardMeta').textContent =
    `${currentRaffle.id} · ${currentRaffle.rangeKey} · ${currentRaffle.mode === 2 ? 'Doble' : 'Sencilla'} · $${currentRaffle.price}`;

  updateStats(currentRaffle);
  renderGrid();
}

function updateStats(raffle) {
  const entries = Object.values(raffle.numbers || {});
  const freeNums = entries.filter(x => x.status === 'libre').length;
  const reservedNums = entries.filter(x => x.status === 'apartado').length;
  const paidNums = entries.filter(x => x.status === 'pagado').length;

  const tickets = Object.values(raffle.tickets || {});
  const paidTickets = tickets.filter(t => t.status === 'pagado').length;

  document.getElementById('stFree').textContent = freeNums;
  document.getElementById('stReserved').textContent = reservedNums;
  document.getElementById('stPaid').textContent = paidNums;
  document.getElementById('stMoney').textContent = '$' + (paidTickets * raffle.price).toFixed(2);
}

function renderGrid() {
  if (!currentRaffle) return;
  const query = document.getElementById('searchNum').value.trim().toLowerCase();
  const grid = document.getElementById('numbersGrid');
  grid.innerHTML = '';

  currentRaffle.rangeCfg.list.forEach(item => {
    const info = currentRaffle.numbers[item.label];
    if (!info) return;
    if (currentFilter !== 'all' && info.status !== currentFilter) return;
    if (query && !item.label.toLowerCase().includes(query)) return;

    const btn = document.createElement('button');
    btn.className = `num-btn ${info.status}`;
    const subText = info.status === 'libre'
      ? (info.pair ? `↔${info.pair}` : '')
      : (info.status === 'pagado' ? 'Pagado' : 'Apartado');

    btn.innerHTML = subText
      ? `<span>${item.label}</span><span class="num-sub">${subText}</span>`
      : `<span>${item.label}</span>`;

    btn.onclick = () => openModal(item.label);
    grid.appendChild(btn);
  });
}

function openModal(label) {
  if (!currentRaffle) return;
  selectedLabel = label;
  const info = currentRaffle.numbers[label];
  const pairBox = document.getElementById('modalPairInfo');

  document.getElementById('modalTitle').textContent = `Número ${label}`;

  if (currentRaffle.mode === 2 && info.pair) {
    pairBox.textContent = `Doble oportunidad: incluye el ${label} y su pareja ${info.pair}.`;
    pairBox.classList.remove('hidden');
  } else {
    pairBox.classList.add('hidden');
  }

  if (info.status === 'libre') {
    document.getElementById('buyerName').value = '';
    document.getElementById('buyerPhone').value = '';
    document.getElementById('registerForm').classList.remove('hidden');
    document.getElementById('manageForm').classList.add('hidden');
  } else {
    const ticket = currentRaffle.tickets?.[info.ticketId];
    document.getElementById('registerForm').classList.add('hidden');
    document.getElementById('manageForm').classList.remove('hidden');

    if (ticket) {
      document.getElementById('ticketDetails').innerHTML = `
        <strong>Números:</strong> ${ticket.numbers.join(' y ')}<br/>
        <strong>Estado:</strong> ${ticket.status.toUpperCase()}<br/>
        <strong>Comprador:</strong> ${ticket.buyerName}<br/>
        <strong>Teléfono:</strong> ${ticket.buyerPhone || 'No registrado'}<br/>
        <strong>Vendedor:</strong> ${ticket.vendor}
      `;
    }

    const actionsDiv = document.getElementById('manageActions');
    actionsDiv.innerHTML = '';
    if (ticket && ticket.status === 'apartado') {
      const payBtn = document.createElement('button');
      payBtn.className = 'btn btn-success';
      payBtn.textContent = 'Confirmar Pago';
      payBtn.onclick = confirmPayment;
      actionsDiv.appendChild(payBtn);
    }
  }

  document.getElementById('modalBackdrop').classList.add('open');
}

function closeModal() {
  document.getElementById('modalBackdrop').classList.remove('open');
  selectedLabel = null;
}

function getGroupLabels(raffle, label) {
  const info = raffle.numbers[label];
  if (raffle.mode === 2 && info.pair && raffle.numbers[info.pair]?.status === 'libre') {
    return [label, info.pair];
  }
  return [label];
}

async function saveTicket(status) {
  if (!currentRaffle || !selectedLabel) return;
  const buyerName = document.getElementById('buyerName').value.trim();
  const buyerPhone = document.getElementById('buyerPhone').value.trim();

  if (!buyerName) {
    alert('Escribe el nombre del comprador.');
    return;
  }

  const group = getGroupLabels(currentRaffle, selectedLabel);
  const ticketId = 'T-' + Date.now();

  currentRaffle.tickets[ticketId] = {
    id: ticketId,
    numbers: group,
    buyerName,
    buyerPhone,
    vendor: activeVendor,
    status,
    updatedAt: new Date().toISOString()
  };

  group.forEach(num => {
    currentRaffle.numbers[num].status = status;
    currentRaffle.numbers[num].ticketId = ticketId;
  });

  try {
    const cleanData = { ...currentRaffle };
    delete cleanData.rangeCfg;
    await updateRaffleInCloud(activeRaffleId, cleanData);
    closeModal();
    renderBoard();
    showToast(status === 'pagado' ? 'Boleto pagado' : 'Boleto apartado');
  } catch (err) {
    console.error(err);
    alert('No se pudo guardar en la nube.');
  }
}

async function confirmPayment() {
  if (!currentRaffle || !selectedLabel) return;
  const ticketId = currentRaffle.numbers[selectedLabel].ticketId;
  const ticket = currentRaffle.tickets[ticketId];
  if (!ticket) return;

  ticket.status = 'pagado';
  ticket.updatedAt = new Date().toISOString();

  ticket.numbers.forEach(num => {
    currentRaffle.numbers[num].status = 'pagado';
  });

  try {
    const cleanData = { ...currentRaffle };
    delete cleanData.rangeCfg;
    await updateRaffleInCloud(activeRaffleId, cleanData);
    closeModal();
    renderBoard();
    showToast('Pago confirmado');
  } catch (err) {
    console.error(err);
    alert('No se pudo confirmar el pago en la nube.');
  }
}

async function releaseTicket() {
  if (!currentRaffle || !selectedLabel) return;
  const info = currentRaffle.numbers[selectedLabel];
  const ticketId = info.ticketId;
  const ticket = currentRaffle.tickets[ticketId];

  if (ticket) {
    ticket.numbers.forEach(num => {
      currentRaffle.numbers[num].status = 'libre';
      currentRaffle.numbers[num].ticketId = null;
    });
    delete currentRaffle.tickets[ticketId];
  } else {
    info.status = 'libre';
    info.ticketId = null;
  }

  try {
    const cleanData = { ...currentRaffle };
    delete cleanData.rangeCfg;
    await updateRaffleInCloud(activeRaffleId, cleanData);
    closeModal();
    renderBoard();
    showToast('Número(s) liberados');
  } catch (err) {
    console.error(err);
    alert('No se pudo liberar el número en la nube.');
  }
}

// Eventos
document.getElementById('btnCreateRaffle').addEventListener('click', createRaffle);
document.getElementById('btnJoinRaffle').addEventListener('click', joinRaffle);
document.getElementById('btnShareCode').addEventListener('click', shareRaffleCode);
document.getElementById('btnGoHome').addEventListener('click', goHome);
document.getElementById('btnSaveReserved').addEventListener('click', () => saveTicket('apartado'));
document.getElementById('btnSavePaid').addEventListener('click', () => saveTicket('pagado'));
document.getElementById('btnReleaseTicket').addEventListener('click', releaseTicket);
document.getElementById('btnCloseModal').addEventListener('click', closeModal);
document.getElementById('searchNum').addEventListener('input', renderGrid);

document.getElementById('modalBackdrop').addEventListener('click', (e) => {
  if (e.target.id === 'modalBackdrop') closeModal();
});

document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => setFilter(chip.dataset.filter, chip));
});

// Acordeones de inicio (Crear / Unirse)
document.querySelectorAll('.accordion-card').forEach(card => {
  const trigger = card.querySelector('.accordion-trigger');
  if (!trigger) return;

  trigger.addEventListener('click', () => {
    const isOpen = card.classList.contains('open');

    document.querySelectorAll('.accordion-card').forEach(other => {
      other.classList.remove('open');
      const otherBtn = other.querySelector('.accordion-trigger');
      if (otherBtn) otherBtn.setAttribute('aria-expanded', 'false');
    });

    if (!isOpen) {
      card.classList.add('open');
      trigger.setAttribute('aria-expanded', 'true');
    }
  });
});

// Instalación PWA y enlace de invitación para descargar
let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  showToast('App Rifa instalada correctamente');
});

const btnInstallApp = document.getElementById('btnInstallApp');
if (btnInstallApp) {
  btnInstallApp.addEventListener('click', async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      const { outcome } = await deferredInstallPrompt.userChoice;
      if (outcome === 'accepted') {
        deferredInstallPrompt = null;
      }
      return;
    }

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;

    if (isStandalone) {
      showToast('Ya tienes la app instalada');
      return;
    }

    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isIOS) {
      alert('En iPhone/iPad: toca el botón Compartir (cuadro con flecha arriba) y selecciona "Agregar a pantalla de inicio".');
    } else {
      alert('Abre el menú de tu navegador (⋮) y toca "Instalar aplicación" o "Agregar a la pantalla principal".');
    }
  });
}

const btnShareApp = document.getElementById('btnShareApp');
if (btnShareApp) {
  btnShareApp.addEventListener('click', async () => {
    const appUrl = window.location.origin + window.location.pathname;
    const shareData = {
      title: 'App Rifa',
      text: 'Descarga e instala App Rifa para llevar el control de tus talonarios en tiempo real:',
      url: appUrl
    };

    if (navigator.share) {
      navigator.share(shareData).catch(() => {});
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(appUrl);
      showToast('Enlace de descarga copiado');
    }
  });
}