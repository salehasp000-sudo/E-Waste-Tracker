// ============================================================
//   E-WASTE BLOCKCHAIN TRACKER — MAIN JS
// ============================================================

/* ── Simulated wallet state ── */
const AppState = {
  walletConnected: false,
  walletAddress: null,
  walletRole: null,
  devices: [
    {
      id: 'DEV-001-BC2E',
      name: 'Samsung Galaxy S22',
      type: 'Smartphone',
      manufacturer: 'Samsung Electronics',
      serial: 'SN-K9X3-2024-7721',
      dop: '2024-01-15',
      status: 'Collected',
      statusCode: 3,
      owner: '0x4f3D...8aE9',
      txHash: '0x9a3b...44fc',
      qrCode: 'DEV-001-BC2E',
      history: [
        { status: 'Registered',      actor: '0x4f3D...8aE9', time: '2024-01-15 10:22', tx: '0x1a2b...c3d4' },
        { status: 'Sold to Consumer', actor: '0x7c8D...1Fa2', time: '2024-01-20 14:05', tx: '0x5e6f...g7h8' },
        { status: 'Collected',        actor: '0xE3a9...9bBc', time: '2024-06-10 09:47', tx: '0x9i0j...k1l2' },
      ]
    },
    {
      id: 'DEV-002-A71F',
      name: 'Dell XPS 15 Laptop',
      type: 'Laptop',
      manufacturer: 'Dell Technologies',
      serial: 'SN-L7Y2-2023-4432',
      dop: '2023-08-22',
      status: 'Recycled',
      statusCode: 5,
      owner: '0x2b1E...3cF8',
      txHash: '0x3c4d...22ab',
      qrCode: 'DEV-002-A71F',
      history: [
        { status: 'Registered',           actor: '0x2b1E...3cF8', time: '2023-08-22 11:00', tx: '0xaa1b...cc2d' },
        { status: 'Sold to Consumer',      actor: '0x9d0E...7fG1', time: '2023-09-01 15:30', tx: '0xee3f...gg4h' },
        { status: 'Collected',             actor: '0xE3a9...9bBc', time: '2024-03-14 08:15', tx: '0xii5j...kk6l' },
        { status: 'Processing by Recycler',actor: '0xA1b2...C3d4', time: '2024-04-02 12:45', tx: '0xmm7n...oo8p' },
        { status: 'Recycled/Disposed',     actor: '0xA1b2...C3d4', time: '2024-04-18 16:00', tx: '0xqq9r...ss0t' },
      ]
    },
    {
      id: 'DEV-003-C33B',
      name: 'Apple MacBook Pro 14"',
      type: 'Laptop',
      manufacturer: 'Apple Inc.',
      serial: 'SN-M2X5-2024-9901',
      dop: '2024-03-10',
      status: 'Registered',
      statusCode: 1,
      owner: '0x6e7F...4dA0',
      txHash: '0x7e8f...55cd',
      qrCode: 'DEV-003-C33B',
      history: [
        { status: 'Registered', actor: '0x6e7F...4dA0', time: '2024-03-10 09:00', tx: '0xuu1v...ww2x' },
      ]
    }
  ],
};

/* ── DOM Helpers ── */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

/* ── Highlight current nav link ── */
function highlightNav() {
  const current = window.location.pathname.split('/').pop() || 'index.html';
  $$('.nav-link').forEach(link => {
    const href = link.getAttribute('href');
    if (href && href.includes(current)) link.classList.add('active');
    else link.classList.remove('active');
  });
}

/* ── Toast notifications ── */
function showToast(message, type = 'info', duration = 3500) {
  let container = $('#toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  const colors = { success: 'var(--green)', error: 'var(--red)', info: 'var(--cyan)' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span style="color:${colors[type]};font-size:1.1rem;font-weight:bold">${icons[type]}</span>
    <span>${message}</span>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s ease reverse';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/* ── Wallet connect simulation ── */
function connectWallet() {
  const btn = $('#connect-wallet-btn');
  if (btn) {
    btn.innerHTML = '<span class="spinner"></span> Connecting...';
    btn.disabled = true;
  }
  setTimeout(() => {
    AppState.walletConnected = true;
    AppState.walletAddress = '0x4f3D8aE9b2C1e7F3d5A6c8B0e2F4a6C8b0E2f4A6';
    AppState.walletRole = 'Manufacturer';
    updateWalletUI();
    showToast('MetaMask wallet connected successfully!', 'success');
  }, 1800);
}

function updateWalletUI() {
  const connectBtn = $('#connect-wallet-btn');
  const walletBadge = $('#wallet-badge');
  const walletInfo = $('#wallet-info');
  if (connectBtn) connectBtn.style.display = 'none';
  if (walletBadge) {
    walletBadge.style.display = 'flex';
    walletBadge.querySelector('.wallet-addr').textContent =
      AppState.walletAddress.slice(0, 6) + '...' + AppState.walletAddress.slice(-4);
  }
  if (walletInfo) {
    walletInfo.innerHTML = `
      <div class="badge badge-green"><span class="dot"></span> Connected</div>
      <div class="mono" style="font-size:0.82rem;color:var(--text-secondary);margin-top:6px">
        ${AppState.walletAddress.slice(0, 10)}...${AppState.walletAddress.slice(-6)}
      </div>
      <div class="badge badge-cyan" style="margin-top:8px">${AppState.walletRole}</div>
    `;
  }
  $$('.wallet-required').forEach(el => el.style.display = 'block');
  $$('.wallet-gate').forEach(el => el.style.display = 'none');
}

/* ── Status helpers ── */
const STATUS_MAP = {
  1: { label: 'Registered',            color: 'cyan',   icon: '📋' },
  2: { label: 'Sold / With Consumer',  color: 'purple', icon: '🛒' },
  3: { label: 'Collected',             color: 'amber',  icon: '📦' },
  4: { label: 'Processing by Recycler',color: 'amber',  icon: '⚙️' },
  5: { label: 'Recycled / Disposed',   color: 'green',  icon: '♻️' },
  6: { label: 'Closed',               color: 'muted',  icon: '✔' },
};

function statusBadge(code) {
  const s = STATUS_MAP[code] || STATUS_MAP[1];
  return `<span class="badge badge-${s.color}">${s.icon} ${s.label}</span>`;
}

/* ── Animate numbers ── */
function animateCount(el, target, duration = 1800) {
  const start = performance.now();
  const from = 0;
  function update(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 4);
    el.textContent = Math.round(from + (target - from) * ease).toLocaleString();
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

/* ── Intersection observer for fade-in ── */
function initScrollAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('anim-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
  $$('[data-anim]').forEach(el => observer.observe(el));
}

/* ── Typing effect ── */
function typewriter(el, text, speed = 60) {
  el.textContent = '';
  let i = 0;
  const interval = setInterval(() => {
    el.textContent += text[i++];
    if (i >= text.length) clearInterval(interval);
  }, speed);
}

/* ── Random hash generator ── */
function randomHash(len = 8) {
  return '0x' + [...Array(len)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
}

/* ── Copy to clipboard ── */
function copyText(text) {
  navigator.clipboard.writeText(text).then(() => showToast('Copied to clipboard!', 'success', 2000));
}

/* ── Modal helpers ── */
function openModal(id) {
  const m = $(`#${id}`);
  if (m) { m.classList.add('open'); document.body.style.overflow = 'hidden'; }
}
function closeModal(id) {
  const m = $(`#${id}`);
  if (m) { m.classList.remove('open'); document.body.style.overflow = ''; }
}

/* ── Mobile Nav ── */
function initMobileNav() {
  const toggle = $('#mobile-nav-toggle');
  const menu = $('#mobile-nav-menu');
  if (!toggle || !menu) return;
  toggle.addEventListener('click', () => {
    menu.classList.toggle('open');
  });
}

/* ── Init ── */
document.addEventListener('DOMContentLoaded', () => {
  highlightNav();
  initScrollAnimations();
  initMobileNav();

  // Wallet connect button
  const wcBtn = $('#connect-wallet-btn');
  if (wcBtn) wcBtn.addEventListener('click', connectWallet);

  // Modal closes
  $$('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = btn.closest('.modal-overlay');
      if (modal) { modal.classList.remove('open'); document.body.style.overflow = ''; }
    });
  });
  $$('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) { overlay.classList.remove('open'); document.body.style.overflow = ''; }
    });
  });

  // Animate stats if any
  $$('[data-count]').forEach(el => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        animateCount(el, parseInt(el.dataset.count), 1800);
        observer.disconnect();
      }
    });
    observer.observe(el);
  });
});