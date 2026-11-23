import { getRangeList, getPairedLabel } from './pairs.js';
import { loadDb, saveDb } from './state.js';

let db = loadDb();
let activeRaffleId = null;
let activeVendor = '';
let currentFilter = 'all';
let selectedLabel = null;

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2200);
}

function createRaffle() {
  const title = document.getElementById('rifaTitle').value.trim() || 'Rifa sin título';
  const rangeKey = document.getElementById('rifaRange').value;
  const mode = Number(document.getElementById('rifaMode').value);
  const price = Number(document.getElementById('rifaPrice').value) || 1;
  const vendor = document.getElementById('creatorName').value.trim() || 'Organizador';

  const code = 'RIFA-' + Math.floor(100 + Math.random() * 900);
  const rangeCfg = getRangeList(rangeKey);
  const numbers = {};

  rangeCfg.list.forEach(n => {
    numbers[n.label] = {
      status: 'libre',
      ticketId: null,
      pair: mode === 2 ? getPairedLabel(n, rangeCfg) : null
    };
  });

  db[code] = {
    id: code,
    title,
    rangeKey,
    rangeCfg,
    mode,
    price,
    numbers,
    tickets: {}
  };

  saveDb(db);
  openBoard(code, vendor);
}

function joinRaffle() {
  const code = document.getElementById('joinCode').value.trim().toUpperCase();
  const vendor = document.getElementById('joinVendor').value.trim() || 'Vendedor';

  if (!db[code]) {
    alert('No se encontró una rifa con ese código en este dispositivo.');
    return;
  }

  openBoard(code, vendor);
}

function shareRaffleCode() {
  if (!activeRaffleId) return;
  const raffle = db[activeRaffleId];
  const text = `Únete a vender la rifa "${raffle.title}" en RifaSync.\nCódigo: ${raffle.id}`;

  if (navigator.share) {
    navigator.share({ title: raffle.title, text }).catch(() => {});
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(raffle.id);
    showToast(`Código ${raffle.id} copiado`);
  }
}

function openBoard(code, vendor) {
  activeRaffleId = code;
  activeVendor = vendor;
  currentFilter = 'all';

  document.querySelectorAll('.chip').forEach(c => {
    c.classList.toggle('active', c.dataset.filter === 'all');
  });
  document.getElementById('searchNum').value = '';

  document.getElementById('viewHome').classList.add('hidden');
  document.getElementById('viewBoard').classList.remove('hidden');
  document.getElementById('headerInfo').textContent = `${code} · ${vendor}`;

  renderBoard();
}

function goHome() {
  activeRaffleId = null;
  document.getElementById('viewBoard').classList.add('hidden');
  document.getElementById('viewHome').classList.remove('hidden');
  document.getElementById('headerInfo').textContent = 'App Móvil';
}

function setFilter(filter, el) {
  currentFilter = filter;
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  renderGrid();
}

function renderBoard() {
  const raffle = db[activeRaffleId];
  document.getElementById('boardTitle').textContent = raffle.title;
  document.getElementById('boardMeta').textContent =
    `${raffle.id} · ${raffle.rangeKey} · ${raffle.mode === 2 ? 'Doble' : 'Sencilla'} · $${raffle.price}`;

  updateStats(raffle);
  renderGrid();
}

function updateStats(raffle) {
  const entries = Object.values(raffle.numbers);
  const freeNums = entries.filter(x => x.status === 'libre').length;
  const reservedNums = entries.filter(x => x.status === 'apartado').length;
  const paidNums = entries.filter(x => x.status === 'pagado').length;

  const tickets = Object.values(raffle.tickets);
  const paidTickets = tickets.filter(t => t.status === 'pagado').length;

  document.getElementById('stFree').textContent = freeNums;
  document.getElementById('stReserved').textContent = reservedNums;
  document.getElementById('stPaid').textContent = paidNums;
  document.getElementById('stMoney').textContent = '$' + (paidTickets * raffle.price).toFixed(2);
}

function renderGrid() {
  const raffle = db[activeRaffleId];
  const query = document.getElementById('searchNum').value.trim().toLowerCase();
  const grid = document.getElementById('numbersGrid');
  grid.innerHTML = '';

  raffle.rangeCfg.list.forEach(item => {
    const info = raffle.numbers[item.label];
    if (currentFilter !== 'all' && info.status !== currentFilter) return;
    if (query && !item.label.toLowerCase().includes(query)) return;

    const btn = document.createElement('button');
    btn.className = `num-btn ${info.status}`;
    const subText = info.status === 'libre'
      ? (info.pair ? `↔${info.pair}` : 'Libre')
      : info.status.toUpperCase();

    btn.innerHTML = `<span>${item.label}</span><span class="num-sub">${subText}</span>`;
    btn.onclick = () => openModal(item.label);
    grid.appendChild(btn);
  });
}

function openModal(label) {
  const raffle = db[activeRaffleId];
  selectedLabel = label;
  const info = raffle.numbers[label];
  const pairBox = document.getElementById('modalPairInfo');

  document.getElementById('modalTitle').textContent = `Número ${label}`;

  if (raffle.mode === 2 && info.pair) {
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
    const ticket = raffle.tickets[info.ticketId];
    document.getElementById('registerForm').classList.add('hidden');
    document.getElementById('manageForm').classList.remove('hidden');

    document.getElementById('ticketDetails').innerHTML = `
      <strong>Números:</strong> ${ticket.numbers.join(' y ')}<br/>
      <strong>Estado:</strong> ${ticket.status.toUpperCase()}<br/>
      <strong>Comprador:</strong> ${ticket.buyerName}<br/>
      <strong>Teléfono:</strong> ${ticket.buyerPhone || 'No registrado'}<br/>
      <strong>Vendedor:</strong> ${ticket.vendor}
    `;

    const actionsDiv = document.getElementById('manageActions');
    actionsDiv.innerHTML = '';
    if (ticket.status === 'apartado') {
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

function saveTicket(status) {
  const raffle = db[activeRaffleId];
  const buyerName = document.getElementById('buyerName').value.trim();
  const buyerPhone = document.getElementById('buyerPhone').value.trim();

  if (!buyerName) {
    alert('Escribe el nombre del comprador.');
    return;
  }

  const group = getGroupLabels(raffle, selectedLabel);
  const ticketId = 'T-' + Date.now();

  raffle.tickets[ticketId] = {
    id: ticketId,
    numbers: group,
    buyerName,
    buyerPhone,
    vendor: activeVendor,
    status,
    updatedAt: new Date().toISOString()
  };

  group.forEach(num => {
    raffle.numbers[num].status = status;
    raffle.numbers[num].ticketId = ticketId;
  });

  saveDb(db);
  closeModal();
  renderBoard();
  showToast(status === 'pagado' ? 'Boleto pagado' : 'Boleto apartado');
}

function confirmPayment() {
  const raffle = db[activeRaffleId];
  const ticketId = raffle.numbers[selectedLabel].ticketId;
  const ticket = raffle.tickets[ticketId];

  ticket.status = 'pagado';
  ticket.updatedAt = new Date().toISOString();

  ticket.numbers.forEach(num => {
    raffle.numbers[num].status = 'pagado';
  });

  saveDb(db);
  closeModal();
  renderBoard();
  showToast('Pago confirmado');
}

function releaseTicket() {
  const raffle = db[activeRaffleId];
  const info = raffle.numbers[selectedLabel];
  const ticketId = info.ticketId;
  const ticket = raffle.tickets[ticketId];

  if (ticket) {
    ticket.numbers.forEach(num => {
      raffle.numbers[num].status = 'libre';
      raffle.numbers[num].ticketId = null;
    });
    delete raffle.tickets[ticketId];
  }

  saveDb(db);
  closeModal();
  renderBoard();
  showToast('Número(s) liberados');
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