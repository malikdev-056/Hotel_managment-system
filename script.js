const today = new Date();
const fmt = d => d.toISOString().split('T')[0];

// const API_BASE = 'http://localhost:4000/api';
const API_BASE = 'https://backend-hotel-mangment.vercel.app/api';
const apiFetch = async (path, options = {}) => {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || 'API request failed');
  }
  if (res.status === 204) return null;
  return res.json();
};

async function loadState() {
  try {
    const [summary, settings, pricing, rooms, reservations, guests, hkTasks, staff, invoices] = await Promise.all([
      apiFetch('/summary'),
      apiFetch('/settings'),
      apiFetch('/pricing'),
      apiFetch('/rooms'),
      apiFetch('/reservations'),
      apiFetch('/guests'),
      apiFetch('/housekeeping'),
      apiFetch('/staff'),
      apiFetch('/invoices'),
    ]);
    Object.assign(state, { summary, settings, pricing, rooms, reservations, guests, hkTasks, staff, invoices, activity: summary.activity || [] });
    renderDashboard();
    renderReservations();
    renderRooms();
    renderGuests();
    renderCheckInOut();
    renderHousekeeping();
    renderBilling();
    renderStaff();
    renderSettings();
  } catch (error) {
    console.warn('Backend unavailable:', error);
    renderDashboard();
    renderReservations();
    renderRooms();
    renderGuests();
    renderCheckInOut();
    renderHousekeeping();
    renderBilling();
    renderStaff();
    renderSettings();
  }
}

let state = {
  settings: {
    hotelName: '',
    address: '',
    phone: '',
    email: '',
    currency: 'USD ($)',
    taxRate: 0,
    guestRating: 0,
  },
  pricing: {
    standard: 0,
    deluxe: 0,
    suite: 0,
    presidential: 0,
    earlyCheckin: 0,
    lateCheckout: 0,
  },
  rooms: [],
  reservations: [],
  guests: [],
  hkTasks: [],
  staff: [],
  invoices: [],
  activity: [],
};

function navigate(page, el) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  if (el) el.classList.add('active');

  const titles = {
    dashboard: 'Dashboard',
    reservations: 'Reservations',
    rooms: 'Room Management',
    guests: 'Guest Management',
    checkinout: 'Check In / Out',
    housekeeping: 'Housekeeping',
    billing: 'Billing & Invoices',
    reports: 'Reports & Analytics',
    staff: 'Staff Management',
    settings: 'Settings',
  };
  document.getElementById('page-title').textContent = titles[page] || page;

  const actions = {
    dashboard: 'New Reservation',
    reservations: 'New Reservation',
    rooms: 'Add Room',
    guests: 'Add Guest',
    checkinout: 'Check In',
    housekeeping: 'Assign Task',
    billing: 'Generate Bill',
    reports: 'Export Report',
    staff: 'Add Staff',
    settings: 'Save All',
  };
  document.getElementById('top-action-btn').textContent = '+ ' + (actions[page] || 'New');
  renderPage(page);
}

function handleTopAction() {
  const pageTitle = document.getElementById('page-title').textContent;
  if (pageTitle.includes('Room')) openModal('roomModal');
  else if (pageTitle.includes('Guest')) openModal('guestModal');
  else if (pageTitle.includes('Staff')) openModal('staffModal');
  else if (pageTitle.includes('Housekeeping')) openModal('hkModal');
  else openModal('reservationModal');
}

function renderPage(page) {
  if (page === 'dashboard') renderDashboard();
  if (page === 'reservations') renderReservations();
  if (page === 'rooms') renderRooms();
  if (page === 'guests') renderGuests();
  if (page === 'checkinout') renderCheckInOut();
  if (page === 'housekeeping') renderHousekeeping();
  if (page === 'billing') renderBilling();
  if (page === 'staff') renderStaff();
  if (page === 'reports') renderReports();
  if (page === 'settings') renderSettings();
}

function renderDashboard() {
  const occupiedCount = state.rooms.filter(r => r.status === 'occupied').length;
  const totalRooms = state.rooms.length;
  const uniqueFloors = [...new Set(state.rooms.map(r => r.floor))].length;
  const todayStr = fmt(today);
  const todayCheckins = state.reservations.filter(r => r.checkin === todayStr && r.status !== 'cancelled').length;
  const scheduledCount = state.reservations.filter(r => r.checkin === todayStr && r.status === 'confirmed').length;
  const revenueToday = state.reservations
    .filter(r => r.checkin === todayStr || r.checkout === todayStr)
    .reduce((sum, r) => sum + r.amount, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = fmt(yesterday);
  const revenueYesterday = state.reservations
    .filter(r => r.checkin === yesterdayStr || r.checkout === yesterdayStr)
    .reduce((sum, r) => sum + r.amount, 0);
  const revenueChange = revenueYesterday ? Math.round((revenueToday - revenueYesterday) / revenueYesterday * 100) : 0;

  document.getElementById('stat-total').textContent = totalRooms;
  document.getElementById('stat-occupancy').textContent = totalRooms ? Math.round((occupiedCount / totalRooms) * 100) + '%' : '0%';
  document.getElementById('stat-occupied-count').textContent = `${occupiedCount} of ${totalRooms} occupied`;
  document.getElementById('stat-floor-count').textContent = `Across ${uniqueFloors} floors`;
  document.getElementById('stat-checkins').textContent = todayCheckins;
  document.getElementById('stat-checkins-sub').textContent = `${scheduledCount} scheduled`;
  document.getElementById('stat-revenue').textContent = `$${revenueToday}`;
  document.getElementById('stat-revenue-sub').textContent = `${revenueChange >= 0 ? '↑' : '↓'} ${Math.abs(revenueChange)}% vs yesterday`;

  const tbody = document.getElementById('recent-reservations-tbody');
  tbody.innerHTML = state.reservations.slice(0, 5).map(r => `
    <tr>
      <td class="td-name">${r.guestName}</td>
      <td>${r.room}</td>
      <td>${r.checkin}</td>
      <td>${statusBadge(r.status)}</td>
    </tr>
  `).join('');

  document.getElementById('activity-feed').innerHTML = state.activity.map(a => `
    <div class="activity-item">
      <div class="activity-dot" style="background:${a.color}"></div>
      <div>
        <div style="font-size:13px;color:var(--text)">${a.text}</div>
        <div class="activity-time">${a.time}</div>
      </div>
    </div>
  `).join('');

  const floors = [...new Set(state.rooms.map(r => r.floor))].sort((a,b)=>a-b);
  document.getElementById('floor-overview').innerHTML = floors.map(f => `
    <div style="margin-bottom:16px">
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:1px">Floor ${f}</div>
      <div class="floor-grid">
        ${state.rooms.filter(r => r.floor === f).map(r => `
          <div class="floor-room ${r.status === 'available' ? 'av' : r.status === 'occupied' ? 'oc' : r.status === 'reserved' ? 'rs' : 'mn'}" title="${r.number} - ${r.type} - ${r.status}">
            ${r.number}
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

function renderReservations(filter = 'all', search = '') {
  let list = [...state.reservations];
  if (filter !== 'all') list = list.filter(r => r.status === filter);
  if (search) list = list.filter(r => r.guestName.toLowerCase().includes(search.toLowerCase()) || r.room.includes(search) || r.id.includes(search));

  document.getElementById('reservations-tbody').innerHTML = list.map(r => `
    <tr>
      <td style="color:var(--gold);font-weight:500">${r.id}</td>
      <td class="td-name">${r.guestName}</td>
      <td>${r.room}</td>
      <td>${r.checkin}</td>
      <td>${r.checkout}</td>
      <td>${r.nights}</td>
      <td style="color:var(--gold)">$${r.amount}</td>
      <td>${statusBadge(r.status)}</td>
      <td>
        <div style="display:flex;gap:6px">
          <button class="btn btn-ghost" style="padding:4px 10px;font-size:11px" onclick="editReservation('${r.id}')">Edit</button>
          <button class="btn btn-primary" style="padding:4px 10px;font-size:11px" onclick="openBillingForReservation('${r.id}')">Bill</button>
          <button class="btn btn-danger" style="padding:4px 10px;font-size:11px" onclick="cancelReservation('${r.id}')">Cancel</button>
        </div>
      </td>
    </tr>
  `).join('');

  document.getElementById('pending-badge').textContent = state.reservations.filter(r => r.status === 'pending').length;
}

let roomFilter = 'all';
function renderRooms() {
  let list = roomFilter === 'all' ? state.rooms : state.rooms.filter(r => r.status === roomFilter);
  document.getElementById('rooms-grid').innerHTML = list.map(r => `
    <div class="room-card ${r.status}" onclick="roomDetail('${r.id}')">
      <div class="room-status-dot dot-${r.status === 'available' ? 'green' : r.status === 'occupied' ? 'red' : r.status === 'reserved' ? 'blue' : 'amber'}"></div>
      <div class="room-number">${r.number}</div>
      <div class="room-type">${r.type} · Floor ${r.floor}</div>
      <div class="room-price">$${r.price}/night</div>
      <div style="margin-top:6px">${statusBadge(r.status)}</div>
    </div>
  `).join('');
}

function renderGuests(search = '') {
  let list = search ? state.guests.filter(g => (g.fname + ' ' + g.lname).toLowerCase().includes(search.toLowerCase()) || g.email.toLowerCase().includes(search.toLowerCase())) : state.guests;
  document.getElementById('guests-tbody').innerHTML = list.map(g => `
    <tr>
      <td style="color:var(--text-dim)">${g.id}</td>
      <td class="td-name">${g.fname} ${g.lname}</td>
      <td>${g.email}</td>
      <td>${g.phone}</td>
      <td>${g.nationality}</td>
      <td>${g.stays}</td>
      <td style="color:var(--gold)">$${g.spent}</td>
      <td>
        <div style="display:flex;gap:6px">
          <button class="btn btn-ghost" style="padding:4px 10px;font-size:11px" onclick="viewGuest('${g.id}')">View</button>
          <button class="btn btn-danger" style="padding:4px 10px;font-size:11px" onclick="deleteGuest('${g.id}')">Delete</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function renderCheckInOut() {
  const checkins = state.reservations.filter(r => r.status === 'confirmed');
  document.getElementById('checkin-tbody').innerHTML = checkins.length ? checkins.map(r => `
    <tr>
      <td style="color:var(--gold)">${r.id}</td>
      <td class="td-name">${r.guestName}</td>
      <td>${r.room}</td>
      <td>${r.checkin}</td>
      <td><span class="badge badge-amber">Pending</span></td>
      <td><button class="btn btn-success" style="padding:5px 12px;font-size:12px" onclick="doCheckIn('${r.id}')">Check In</button></td>
    </tr>
  `).join('') : `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-dim)">No pending check-ins</td></tr>`;

  const checkouts = state.reservations.filter(r => r.status === 'checked-in');
  document.getElementById('checkout-tbody').innerHTML = checkouts.length ? checkouts.map(r => `
    <tr>
      <td style="color:var(--gold)">${r.id}</td>
      <td class="td-name">${r.guestName}</td>
      <td>${r.room}</td>
      <td>${r.checkout}</td>
      <td style="color:var(--gold)">$${r.amount}</td>
      <td><button class="btn btn-danger" style="padding:5px 12px;font-size:12px" onclick="doCheckOut('${r.id}')">Check Out</button></td>
    </tr>
  `).join('') : `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-dim)">No active check-ins</td></tr>`;
}

let hkFilter = 'all';
function renderHousekeeping() {
  let list = hkFilter === 'all' ? state.hkTasks : state.hkTasks.filter(t => t.status === hkFilter);
  document.getElementById('hk-tbody').innerHTML = list.length ? list.map(t => `
    <tr>
      <td style="color:var(--text-dim)">${t.id}</td>
      <td class="td-name">Room ${t.room}</td>
      <td>${t.type}</td>
      <td>${t.staff}</td>
      <td>${priorityBadge(t.priority)}</td>
      <td>${hkStatusBadge(t.status)}</td>
      <td style="max-width:120px;overflow:hidden;text-overflow:ellipsis">${t.notes || '—'}</td>
      <td>
        <div style="display:flex;gap:6px">
          ${t.status !== 'completed' ? `<button class="btn btn-success" style="padding:4px 10px;font-size:11px" onclick="completeHK('${t.id}')">Done</button>` : ''}
          <button class="btn btn-danger" style="padding:4px 10px;font-size:11px" onclick="deleteHK('${t.id}')">Del</button>
        </div>
      </td>
    </tr>
  `).join('') : `<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--text-dim)">No tasks found</td></tr>`;
}

function renderBilling() {
  document.getElementById('billing-tbody').innerHTML = state.invoices.map(inv => `
    <tr>
      <td style="color:var(--gold)">${inv.id}</td>
      <td class="td-name">${inv.guest}</td>
      <td>${inv.room}</td>
      <td>${inv.dates}</td>
      <td>$${inv.amount}</td>
      <td style="color:${inv.paid ? 'var(--green)' : 'var(--red)'}">$${inv.paid}</td>
      <td>${inv.status === 'paid' ? '<span class="badge badge-green">Paid</span>' : '<span class="badge badge-red">Unpaid</span>'}</td>
      <td>
        <div style="display:flex;gap:6px">
          ${inv.status !== 'paid' ? `<button class="btn btn-success" style="padding:4px 10px;font-size:11px" onclick="markPaid('${inv.id}')">Mark Paid</button>` : ''}
          <button class="btn btn-ghost" style="padding:4px 10px;font-size:11px" onclick="printInvoice('${inv.id}')">Print</button>
        </div>
      </td>
    </tr>
  `).join('');

  const sel = document.getElementById('bill-booking-select');
  const billable = state.reservations.filter(r => r.status !== 'cancelled');
  sel.innerHTML = '<option value="">-- Select Booking --</option>' + billable.map(r => `<option value="${r.id}">${r.id} — ${r.guestName} (Room ${r.room})</option>`).join('');
}

function getGuestForReservation(reservation) {
  return state.guests.find(g => g.id === reservation.guestId || `${g.fname} ${g.lname}` === reservation.guestName);
}

function openBillingForReservation(id) {
  const nav = document.querySelector('[onclick*=billing]');
  if (nav) navigate('billing', nav);
  const tabs = document.querySelectorAll('#page-billing .tab');
  tabs.forEach(t => t.classList.remove('active'));
  const genTab = document.querySelector('#page-billing .tab[onclick*=generate-tab]') || tabs[1];
  if (genTab) genTab.classList.add('active');
  document.getElementById('invoices-tab').style.display = 'none';
  document.getElementById('generate-tab').style.display = 'block';
  const sel = document.getElementById('bill-booking-select');
  if (sel) {
    sel.value = id;
    loadBillPreview();
  }
}

function renderReports() {
  const monthlyRevenue = state.invoices.reduce((sum, inv) => sum + inv.amount, 0);
  const avgOccupancy = state.rooms.length ? Math.round(state.rooms.filter(r => r.status === 'occupied').length / state.rooms.length * 100) : 0;
  const totalBookings = state.reservations.length;
  const avgDailyRate = state.rooms.length ? Math.round(state.rooms.reduce((sum, r) => sum + r.price, 0) / state.rooms.length) : 0;
  const avgStay = state.reservations.length ? Math.round(state.reservations.reduce((sum, r) => sum + r.nights, 0) / state.reservations.length) : 0;

  const metrics = [
    {label: 'Monthly Revenue', value: `$${monthlyRevenue}`},
    {label: 'Avg Occupancy', value: `${avgOccupancy}%`},
    {label: 'Total Bookings', value: totalBookings},
    {label: 'Avg Daily Rate', value: `$${avgDailyRate}`},
    {label: 'Avg Stay (nights)', value: avgStay},
    {label: 'Guest Rating', value: `${state.settings.guestRating.toFixed(1)} ★`},
  ];
  document.getElementById('report-metrics').innerHTML = metrics.map(m => `
    <div class="report-metric"><div class="val">${m.value}</div><div class="lbl">${m.label}</div></div>
  `).join('');

  const stats = Object.values(state.rooms.reduce((acc, room) => {
    if (!acc[room.type]) acc[room.type] = {type: room.type, count: 0, totalRate: 0, occupied: 0, revenue: 0};
    acc[room.type].count += 1;
    acc[room.type].totalRate += room.price;
    if (room.status === 'occupied') acc[room.type].occupied += 1;
    return acc;
  }, {}));

  const invoiceMap = state.invoices.reduce((map, inv) => {
    map[inv.room] = (map[inv.room] || 0) + inv.amount;
    return map;
  }, {});

  document.getElementById('report-performance-tbody').innerHTML = stats.map(stat => {
    const revenue = state.rooms.filter(r => r.type === stat.type).reduce((sum, room) => sum + (invoiceMap[room.number] || 0), 0);
    const occupancy = stat.count ? Math.round(stat.occupied / stat.count * 100) : 0;
    return `
      <tr>
        <td class="td-name">${stat.type}</td>
        <td>${stat.count}</td>
        <td>$${Math.round(stat.totalRate / stat.count)}</td>
        <td><span class="badge ${occupancy > 75 ? 'badge-green' : occupancy > 50 ? 'badge-amber' : 'badge-red'}">${occupancy}%</span></td>
        <td>$${revenue}</td>
      </tr>
    `;
  }).join('');

  const baseRevenue = monthlyRevenue / 7;
  const revData = [0.9, 1.1, 1.0, 0.95, 1.05, 1.2, 1.0].map(f => Math.round(baseRevenue * f));
  const occData = [avgOccupancy - 4, avgOccupancy - 2, avgOccupancy + 1, avgOccupancy, avgOccupancy + 3, avgOccupancy + 1, avgOccupancy - 1]
    .map(v => Math.min(100, Math.max(0, Math.round(v))));

  document.getElementById('revenue-chart').innerHTML = revData.map(v => `<div class="bar bar-gold" style="height:${Math.max(12, Math.round(v / Math.max(1, Math.max(...revData)) * 80))}px" title="$${v}"></div>`).join('');
  document.getElementById('occupancy-chart').innerHTML = occData.map(v => `<div class="bar bar-blue" style="height:${Math.max(12, Math.round(v / 100 * 80))}px" title="${v}%"></div>`).join('');
}

function renderStaff(search = '') {
  let list = search ? state.staff.filter(s => (s.fname + ' ' + s.lname).toLowerCase().includes(search.toLowerCase()) || s.role.toLowerCase().includes(search.toLowerCase())) : state.staff;
  document.getElementById('staff-tbody').innerHTML = list.map(s => `
    <tr>
      <td style="color:var(--text-dim)">${s.id}</td>
      <td class="td-name">${s.fname} ${s.lname}</td>
      <td>${s.role}</td>
      <td>${s.dept}</td>
      <td style="font-size:12px">${s.shift}</td>
      <td>${s.phone}</td>
      <td><span class="badge badge-green">Active</span></td>
      <td>
        <div style="display:flex;gap:6px">
          <button class="btn btn-ghost" style="padding:4px 10px;font-size:11px" onclick="showToast('Staff profile viewed','success')">View</button>
          <button class="btn btn-danger" style="padding:4px 10px;font-size:11px" onclick="deleteStaff('${s.id}')">Remove</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function renderSettings() {
  document.getElementById('hotel-name').value = state.settings.hotelName;
  document.getElementById('hotel-address').value = state.settings.address;
  document.getElementById('hotel-phone').value = state.settings.phone;
  document.getElementById('hotel-email').value = state.settings.email;
  document.getElementById('hotel-currency').value = state.settings.currency;
  document.getElementById('hotel-tax').value = state.settings.taxRate;

  document.getElementById('price-standard').value = state.pricing.standard;
  document.getElementById('price-deluxe').value = state.pricing.deluxe;
  document.getElementById('price-suite').value = state.pricing.suite;
  document.getElementById('price-presidential').value = state.pricing.presidential;
  document.getElementById('fee-early-checkin').value = state.pricing.earlyCheckin;
  document.getElementById('fee-late-checkout').value = state.pricing.lateCheckout;
}

function statusBadge(s) {
  const map = {'confirmed':'badge-green','pending':'badge-amber','checked-in':'badge-blue','checked-out':'badge-gray','cancelled':'badge-red'};
  return `<span class="badge ${map[s]||'badge-gray'}">${s.replace('-', ' ')}</span>`;
}

function priorityBadge(p) {
  const map = {'Normal':'badge-gray','High':'badge-amber','Urgent':'badge-red'};
  return `<span class="badge ${map[p]||'badge-gray'}">${p}</span>`;
}

function hkStatusBadge(s) {
  const map = {'pending':'badge-amber','in-progress':'badge-blue','completed':'badge-green'};
  return `<span class="badge ${map[s]||'badge-gray'}">${s.replace('-', ' ')}</span>`;
}

let resFilterCurrent = 'all';
function setResFilter(f, el) {
  resFilterCurrent = f;
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  renderReservations(f, document.getElementById('res-search')?.value || '');
}

function filterReservations() { renderReservations(resFilterCurrent, document.getElementById('res-search').value); }

function setRoomFilter(f, el) {
  roomFilter = f;
  document.querySelectorAll('#page-rooms .filter-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  renderRooms();
}

function filterGuests() { renderGuests(document.getElementById('guest-search').value); }
function filterStaff() { renderStaff(document.getElementById('staff-search').value); }

function setHKFilter(f, el) {
  hkFilter = f;
  document.querySelectorAll('#page-housekeeping .filter-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  renderHousekeeping();
}

function switchTab(tabId, el) {
  const parent = el.closest('.page');
  parent.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  const allTabs = parent.querySelectorAll('[id$="-tab"]');
  allTabs.forEach(t => t.style.display = 'none');
  document.getElementById(tabId).style.display = 'block';
}

async function doCheckIn(id) {
  try {
    await apiFetch(`/reservations/${id}/checkin`, { method: 'POST' });
    await loadState();
    showToast('Guest checked in successfully', 'success');
  } catch (error) {
    console.error(error);
    showToast('Check-in failed', 'error');
  }
}

async function doCheckOut(id) {
  try {
    await apiFetch(`/reservations/${id}/checkout`, { method: 'POST' });
    await loadState();
    showToast('Guest checked out and invoice generated', 'success');
  } catch (error) {
    console.error(error);
    showToast('Check-out failed', 'error');
  }
}

async function cancelReservation(id) {
  try {
    await apiFetch(`/reservations/${id}/cancel`, { method: 'POST' });
    await loadState();
    showToast('Reservation cancelled', 'success');
  } catch (error) {
    console.error(error);
    showToast('Failed to cancel reservation', 'error');
  }
}

async function deleteHK(id) {
  try {
    await apiFetch(`/housekeeping/${id}`, { method: 'DELETE' });
    await loadState();
    showToast('Task removed', 'success');
  } catch (error) {
    console.error(error);
    showToast('Failed to remove task', 'error');
  }
}

async function completeHK(id) {
  try {
    await apiFetch(`/housekeeping/${id}/complete`, { method: 'PATCH' });
    await loadState();
    showToast('Task marked complete', 'success');
  } catch (error) {
    console.error(error);
    showToast('Failed to complete task', 'error');
  }
}

async function deleteGuest(id) {
  try {
    await apiFetch(`/guests/${id}`, { method: 'DELETE' });
    await loadState();
    showToast('Guest removed', 'success');
  } catch (error) {
    console.error(error);
    showToast('Failed to remove guest', 'error');
  }
}
function viewGuest(id) { const g = state.guests.find(x => x.id === id); if (g) showToast(`Viewing: ${g.fname} ${g.lname}`, 'success'); }
async function deleteStaff(id) {
  try {
    await apiFetch(`/staff/${id}`, { method: 'DELETE' });
    await loadState();
    showToast('Staff removed', 'success');
  } catch (error) {
    console.error(error);
    showToast('Failed to remove staff', 'error');
  }
}
function roomDetail(id) { const r = state.rooms.find(x => x.id === id); if (r) showToast(`Room ${r.number} — ${r.type} — ${r.status}`, 'success'); }
function editReservation(id) { showToast('Edit functionality ready for backend integration', 'success'); }
async function markPaid(id) {
  try {
    await apiFetch(`/invoices/${id}/pay`, { method: 'PATCH' });
    await loadState();
    addActivity(`Invoice ${id} marked as paid`, 'var(--gold)');
    showToast('Invoice marked as paid', 'success');
  } catch (error) {
    console.error(error);
    showToast('Failed to mark invoice paid', 'error');
  }
}
function printInvoice(id) { showToast('Printing invoice ' + id, 'success'); }

function loadBillPreview() {
  const sel = document.getElementById('bill-booking-select');
  const id = sel.value;
  const r = state.reservations.find(x => x.id === id);
  const preview = document.getElementById('bill-preview');
  if (!r) { preview.style.display = 'none'; return; }
  preview.style.display = 'block';
  const tax = Math.round(r.amount * 0.1);
  const total = r.amount + tax;
  const guest = getGuestForReservation(r);
  document.getElementById('bill-details').innerHTML = `
    <div style="display:flex;justify-content:space-between;margin-bottom:8px">
      <div><div style="font-family:Cormorant Garamond,serif;font-size:20px;color:var(--gold)">LuxeStay</div><div style="font-size:12px;color:var(--text-muted)">Grand Hotel</div></div>
      <div style="text-align:right"><div style="font-size:12px;color:var(--text-muted)">Booking</div><div style="color:var(--gold);font-weight:500">${r.id}</div></div>
    </div>
    <div style="margin-bottom:12px">
      <div style="font-size:14px;font-weight:600">Guest Details</div>
      <div style="font-size:13px;color:var(--text)">${r.guestName}</div>
      ${guest ? `<div style="font-size:12px;color:var(--text-muted)">Email: ${guest.email || 'N/A'}</div><div style="font-size:12px;color:var(--text-muted)">Phone: ${guest.phone || 'N/A'}</div>` : ''}
      <div style="font-size:12px;color:var(--text-muted)">Room ${r.room} · ${r.checkin} → ${r.checkout}</div>
    </div>`;
  document.getElementById('bill-line-items').innerHTML = `
    <div class="bill-row"><span class="label">Room Charge (${r.nights} nights × $${r.nights ? Math.round(r.amount / r.nights) : r.amount})</span><span class="amount">$${r.amount}</span></div>
    <div class="bill-row"><span class="label">Tax (10%)</span><span class="amount">$${tax}</span></div>
    <div class="bill-row total"><span class="label">Total Due</span><span class="amount">$${total}</span></div>`;
}

async function generateInvoice() {
  const sel = document.getElementById('bill-booking-select');
  const id = sel.value;
  const r = state.reservations.find(x => x.id === id);
  if (!r) return;
  const tax = Math.round(r.amount * 0.1);
  const payload = {
    bookingId: r.id,
    guest: r.guestName,
    room: r.room,
    dates: `${r.checkin} – ${r.checkout}`,
    amount: r.amount + tax,
  };
  try {
    await apiFetch('/invoices', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    await loadState();
    addActivity(`Invoice generated for ${r.guestName}`, 'var(--gold)');
    showToast('Invoice generated successfully', 'success');
    document.getElementById('bill-preview').style.display = 'none';
    sel.value = '';
  } catch (error) {
    console.error(error);
    showToast('Failed to generate invoice', 'error');
  }
}

async function saveReservation() {
  const fn = v('res-fname'), ln = v('res-lname'), email = v('res-email'), phone = v('res-phone'), room = v('res-room'), ci = v('res-checkin'), co = v('res-checkout');
  if (!fn || !ln || !room || !ci || !co) { showToast('Please fill required fields', 'error'); return; }
  const nights = Math.max(1, Math.round((new Date(co) - new Date(ci)) / 86400000));
  const roomObj = state.rooms.find(r => r.number === room);
  const amount = roomObj ? roomObj.price * nights : 0;
  const payload = {
    guestId: 'G_NEW',
    guestName: fn + ' ' + ln,
    room,
    checkin: ci,
    checkout: co,
    nights,
    amount,
    status: v('res-status') || 'confirmed',
    payment: v('res-payment'),
    notes: v('res-notes'),
  };
  try {
    await apiFetch('/reservations', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    await loadState();
    addActivity(`New reservation created for ${fn} ${ln}`, 'var(--blue)');
    showToast('Reservation created successfully', 'success');
    closeModal('reservationModal');
  } catch (error) {
    console.error(error);
    showToast('Failed to create reservation', 'error');
  }
}

async function saveRoom() {
  const num = v('room-number');
  if (!num) { showToast('Room number required', 'error'); return; }
  const payload = {
    number: num,
    floor: parseInt(v('room-floor')) || 1,
    type: v('room-type'),
    capacity: parseInt(v('room-capacity')) || 1,
    price: parseFloat(v('room-price')) || 120,
    status: v('room-status-select'),
    amenities: v('room-amenities'),
  };
  try {
    await apiFetch('/rooms', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    await loadState();
    showToast('Room added successfully', 'success');
    closeModal('roomModal');
  } catch (error) {
    console.error(error);
    showToast('Failed to add room', 'error');
  }
}

async function saveGuest() {
  const fn = v('guest-fname'), ln = v('guest-lname');
  if (!fn || !ln) { showToast('Name required', 'error'); return; }
  const payload = {
    fname: fn,
    lname: ln,
    email: v('guest-email'),
    phone: v('guest-phone'),
    nationality: v('guest-nationality'),
    idType: v('guest-id-type'),
    idNum: v('guest-id-number'),
  };
  try {
    await apiFetch('/guests', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    await loadState();
    showToast('Guest added successfully', 'success');
    closeModal('guestModal');
  } catch (error) {
    console.error(error);
    showToast('Failed to add guest', 'error');
  }
}

async function saveHKTask() {
  const room = v('hk-room'), staff = v('hk-staff');
  if (!room) { showToast('Room required', 'error'); return; }
  const payload = {
    room,
    type: v('hk-type'),
    staff,
    priority: v('hk-priority'),
    notes: v('hk-notes'),
  };
  try {
    await apiFetch('/housekeeping', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    await loadState();
    showToast('Task assigned', 'success');
    closeModal('hkModal');
  } catch (error) {
    console.error(error);
    showToast('Failed to assign task', 'error');
  }
}

async function saveStaff() {
  const fn = v('staff-fname'), ln = v('staff-lname');
  if (!fn || !ln) { showToast('Name required', 'error'); return; }
  const payload = {
    fname: fn,
    lname: ln,
    role: v('staff-role'),
    dept: v('staff-dept'),
    shift: v('staff-shift'),
    phone: v('staff-phone'),
    email: v('staff-email'),
  };
  try {
    await apiFetch('/staff', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    await loadState();
    showToast('Staff member added', 'success');
    closeModal('staffModal');
  } catch (error) {
    console.error(error);
    showToast('Failed to add staff member', 'error');
  }
}

async function saveSettings() {
  const payload = {
    hotelName: v('hotel-name'),
    address: v('hotel-address'),
    phone: v('hotel-phone'),
    email: v('hotel-email'),
    currency: v('hotel-currency'),
    taxRate: parseFloat(v('hotel-tax')) || state.settings.taxRate,
  };
  try {
    await apiFetch('/settings', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    state.settings = payload;
    showToast('Settings saved successfully', 'success');
  } catch (error) {
    console.error(error);
    showToast('Failed to save settings', 'error');
  }
}

async function savePricing() {
  const payload = {
    standard: parseFloat(v('price-standard')) || state.pricing.standard,
    deluxe: parseFloat(v('price-deluxe')) || state.pricing.deluxe,
    suite: parseFloat(v('price-suite')) || state.pricing.suite,
    presidential: parseFloat(v('price-presidential')) || state.pricing.presidential,
    earlyCheckin: parseFloat(v('fee-early-checkin')) || state.pricing.earlyCheckin,
    lateCheckout: parseFloat(v('fee-late-checkout')) || state.pricing.lateCheckout,
  };
  try {
    await apiFetch('/pricing', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    state.pricing = payload;
    showToast('Pricing updated', 'success');
  } catch (error) {
    console.error(error);
    showToast('Failed to update pricing', 'error');
  }
}

function openModal(id) {
  populateModalSelects();
  document.getElementById(id).classList.add('open');
}

function closeModal(id) { document.getElementById(id).classList.remove('open'); }

document.querySelectorAll('.modal-overlay').forEach(m => m.addEventListener('click', function(e) { if (e.target === this) this.classList.remove('open'); }));

function populateModalSelects() {
  const avail = state.rooms.filter(r => r.status === 'available');
  const roomSel = document.getElementById('res-room');
  if (roomSel) roomSel.innerHTML = '<option value="">Select Room</option>' + avail.map(r => `<option value="${r.number}">${r.number} - ${r.type} ($${r.price}/n)</option>`).join('');

  const hkRoom = document.getElementById('hk-room');
  if (hkRoom) hkRoom.innerHTML = state.rooms.map(r => `<option value="${r.number}">${r.number} (${r.status})</option>`).join('');

  const hkStaff = document.getElementById('hk-staff');
  if (hkStaff) hkStaff.innerHTML = state.staff.filter(s => s.dept === 'Housekeeping').map(s => `<option value="${s.fname} ${s.lname}">${s.fname} ${s.lname}</option>`).join('');
}

function v(id) { return document.getElementById(id)?.value?.trim() || ''; }
function addActivity(text, color) { state.activity.unshift({text,time:'just now',color}); if (state.activity.length > 10) state.activity.pop(); }

let toastTimer;
function showToast(msg, type='success') {
  const t = document.getElementById('toast');
  t.className = 'toast toast-' + (type === 'success' ? 'success' : 'error');
  document.getElementById('toast-msg').textContent = msg;
  t.querySelector('.toast-icon').textContent = type === 'success' ? '✓' : '✕';
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
}

function logout() {
  localStorage.removeItem('luxestayLoggedIn');
  window.location.href = 'login.html';
}

function updateDate() {
  const now = new Date();
  document.getElementById('current-date').textContent = now.toLocaleDateString('en-US', {weekday:'short',month:'short',day:'numeric',year:'numeric'});
}
updateDate();
setInterval(updateDate, 60000);

const ci = document.getElementById('res-checkin');
const co = document.getElementById('res-checkout');
if (ci) ci.value = fmt(today);
if (co) { const t = new Date(today); t.setDate(t.getDate() + 1); co.value = fmt(t); }

loadState();
