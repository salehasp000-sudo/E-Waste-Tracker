/* ==========================================================================
   E-Waste Tracker — shared app layer
   Loaded on every page. Provides: navbar/footer, wallet connection, role
   detection, notices/toasts, a transaction helper and small utilities.
   Page scripts use it through the global `EW` object.
   ========================================================================== */
(function () {
  'use strict';

  const C = window.EW_CONFIG;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  const ROLE_LABELS = { admin: 'Admin', manufacturer: 'Manufacturer', collector: 'Collector', recycler: 'Recycler', regulator: 'Regulator' };

  const NAV = [
    { id: 'home', href: 'index.html', label: 'Home' },
    { id: 'register', href: 'register.html', label: 'Register' },
    { id: 'track', href: 'track.html', label: 'Track' },
    { id: 'lifecycle', href: 'lifecycle.html', label: 'Lifecycle' },
    { id: 'transfer', href: 'transfer.html', label: 'Transfer' },
    { id: 'dashboard', href: 'dashboard.html', label: 'Dashboard' },
    { id: 'admin', href: 'admin.html', label: 'Admin' }
  ];

  const LOGO = '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="1" y="1" width="30" height="30" rx="9" fill="#0b2b26" stroke="rgba(255,255,255,.15)"/><path d="M9 16a7 7 0 0 1 12-5" stroke="#2fb992" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M23 16a7 7 0 0 1-12 5" stroke="#e0b45a" stroke-width="2.4" fill="none" stroke-linecap="round"/><circle cx="21.5" cy="9.5" r="2.2" fill="#e0b45a"/><circle cx="10.5" cy="22.5" r="2.2" fill="#2fb992"/></svg>';
  const COPY_ICON = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

  const state = { provider: null, signer: null, contract: null, address: null, chainId: null, roles: null, ready: false };
  const listeners = [];
  let readerContract = null;
  let iface = null;

  /* ---------- Small helpers ---------- */
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* private mode */ } }
  };

  const escapeHtml = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const shortAddr = (a) => (a ? a.slice(0, 6) + '…' + a.slice(-4) : '');
  const shortHash = (h) => (h && h.length > 22 ? h.slice(0, 12) + '…' + h.slice(-8) : h || '');
  const statusLabel = (i) => C.STATUS_LABELS[Number(i)] || 'Unknown';
  const toTimestamp = (dateStr) => (dateStr ? Math.floor(new Date(dateStr).getTime() / 1000) : 0);
  const fmtDate = (ts) => (Number(ts) ? new Date(Number(ts) * 1000).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—');
  const fmtDay = (ts) => (Number(ts) ? new Date(Number(ts) * 1000).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—');
  const isZeroAddr = (a) => !a || /^0x0{40}$/i.test(a);

  function monoCopy(value, display) {
    const v = escapeHtml(value);
    return `<span class="mono" title="${v}">${escapeHtml(display == null ? value : display)}</span><button type="button" class="copy-btn" data-copy="${v}" aria-label="Copy to clipboard">${COPY_ICON}</button>`;
  }
  const addrHtml = (a) => (isZeroAddr(a) ? '<span class="muted">—</span>' : monoCopy(a, shortAddr(a)));

  function stepsHtml(current) {
    const cur = Number(current);
    return '<ol class="steps" aria-label="Lifecycle progress">' + C.STATUS_LABELS.map((label, i) =>
      `<li class="${i < cur ? 'is-done' : i === cur ? 'is-current' : ''}"${i === cur ? ' aria-current="step"' : ''}><span class="step-dot"></span><span class="step-label">${escapeHtml(label)}</span></li>`
    ).join('') + '</ol>';
  }

  function parseError(e) {
    if (!e) return 'Something went wrong. Please try again.';
    if (e.code === 'ACTION_REJECTED' || e.code === 4001 || (e.info && e.info.error && e.info.error.code === 4001)) return 'You cancelled the request in your wallet.';
    const name = (e.revert && e.revert.name) || e.errorName;
    if (name === 'AccessControlUnauthorizedAccount') return 'This wallet does not have the role required for this action.';
    if (e.code === 'INSUFFICIENT_FUNDS') return 'Not enough Sepolia ETH to pay for gas. Get some from a Sepolia faucet.';
    if (e.code === 'BAD_DATA') return 'The contract did not answer. Check the contract address in js/config.js and that you are on Sepolia.';
    if (e.code === 'NETWORK_ERROR' || e.code === 'SERVER_ERROR' || e.code === 'TIMEOUT') return 'Could not reach the Sepolia network. Check your connection and try again.';
    if (e.reason) return String(e.reason).slice(0, 220);
    if (e.code === 'CALL_EXCEPTION') return 'The contract rejected this request. Check the device ID and that your wallet has the right role.';
    if (e.shortMessage) return String(e.shortMessage).slice(0, 220);
    if (e.info && e.info.error && e.info.error.message) return String(e.info.error.message).slice(0, 220);
    if (e.message) return String(e.message).slice(0, 220);
    return String(e).slice(0, 220);
  }

  function getEl(el) { return typeof el === 'string' ? document.getElementById(el) : el; }

  function notice(el, type, text, opts) {
    el = getEl(el);
    if (!el) return;
    el.className = 'notice notice-' + type + (el.dataset.keep ? ' ' + el.dataset.keep : '');
    el.hidden = false;
    el.setAttribute('role', type === 'err' ? 'alert' : 'status');
    el.textContent = '';
    const span = document.createElement('span');
    span.textContent = text;
    el.appendChild(span);
    if (opts && opts.tx) {
      const a = document.createElement('a');
      a.href = C.EXPLORER + '/tx/' + opts.tx;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = 'View on Etherscan';
      el.append(a);
    }
  }
  function clearNotice(el) { el = getEl(el); if (el) { el.hidden = true; el.textContent = ''; } }

  function toast(type, message, ms) {
    let box = $('#toasts');
    if (!box) { box = document.createElement('div'); box.id = 'toasts'; box.className = 'toasts'; box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
    const t = document.createElement('div');
    t.className = 'toast toast-' + type;
    t.textContent = message;
    box.appendChild(t);
    setTimeout(() => t.remove(), ms || 4200);
  }

  function setBusy(btn, on) {
    if (!btn) return;
    btn.disabled = !!on;
    btn.classList.toggle('is-busy', !!on);
    btn.setAttribute('aria-busy', on ? 'true' : 'false');
  }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); toast('success', 'Copied to clipboard.', 1800); }
    catch (e) { toast('error', 'Could not copy. Select the text and copy it manually.'); }
  }

  function countUp(el, target, ms) {
    el = getEl(el);
    if (!el) return;
    const end = Number(target) || 0;
    if (reduceMotion || end === 0) { el.textContent = end.toLocaleString(); return; }
    const start = performance.now();
    const dur = ms || 900;
    (function tick(now) {
      const p = Math.min(1, (now - start) / dur);
      el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3))).toLocaleString();
      if (p < 1) requestAnimationFrame(tick);
    })(start);
  }

  function initTilt(el, max) {
    el = getEl(el);
    if (!el || reduceMotion || !window.matchMedia('(hover: hover)').matches) return;
    const deg = max || Number(el.dataset.tilt) || 4;
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = `perspective(1000px) rotateX(${(-y * deg).toFixed(2)}deg) rotateY(${(x * deg).toFixed(2)}deg)`;
    });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  }

  /* ---------- Chain access ---------- */
  function reader() {
    if (!readerContract) {
      const provider = new ethers.JsonRpcProvider(C.RPC_URL, C.CHAIN_ID, { staticNetwork: true, batchMaxCount: 1 });
      readerContract = new ethers.Contract(C.CONTRACT_ADDRESS, C.ABI, provider);
    }
    return readerContract;
  }
  // Contract for reads that depend on WHO is asking (role-restricted views).
  // Uses the connected wallet as the caller when on Sepolia; otherwise the public reader.
  function viewer() {
    return (state.contract && state.chainId === C.CHAIN_ID) ? state.contract : reader();
  }
  function iface_() { if (!iface) iface = new ethers.Interface(C.ABI); return iface; }

  async function switchNetwork() {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: C.CHAIN_HEX }] });
    } catch (e) {
      if (e && e.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{ chainId: C.CHAIN_HEX, chainName: 'Sepolia', nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: [C.RPC_URL], blockExplorerUrls: [C.EXPLORER] }]
        });
      } else { throw e; }
    }
  }

  async function loadRoles() {
    try {
      const r = await viewer().getUserRoles(state.address);
      state.roles = { admin: r[0], manufacturer: r[1], collector: r[2], recycler: r[3], regulator: r[4] };
    } catch (e) { state.roles = null; }
  }

  function snapshot() {
    return { address: state.address, chainId: state.chainId, roles: state.roles, connected: !!state.address, onSepolia: state.chainId === C.CHAIN_ID };
  }
  function emit() {
    const snap = snapshot();
    listeners.forEach((fn) => { try { fn(snap); } catch (e) { console.error(e); } });
  }
  function onChange(fn) { listeners.push(fn); if (state.ready) fn(snapshot()); }

  function resetState() {
    state.provider = state.signer = state.contract = state.address = state.chainId = state.roles = null;
  }

  async function connect(silent) {
    if (typeof ethers === 'undefined') { toast('error', 'The blockchain library failed to load. Check your connection and reload the page.'); return false; }
    if (!window.ethereum) { if (!silent) toast('error', 'No wallet detected. Install MetaMask or another browser wallet to continue.'); return false; }
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send(silent ? 'eth_accounts' : 'eth_requestAccounts', []);
      if (!accounts || !accounts.length) { resetState(); renderWallet(); emit(); return false; }
      const network = await provider.getNetwork();
      state.provider = provider;
      state.signer = await provider.getSigner(accounts[0]);
      state.address = ethers.getAddress(accounts[0]);
      state.chainId = Number(network.chainId);
      state.contract = ethers.isAddress(C.CONTRACT_ADDRESS) ? new ethers.Contract(C.CONTRACT_ADDRESS, C.ABI, state.signer) : null;
      store.set('ew_connected', '1');
      await loadRoles();
      renderWallet();
      emit();
      return true;
    } catch (e) {
      if (!silent) toast('error', parseError(e));
      return false;
    }
  }

  function forgetWallet() {
    store.del('ew_connected');
    resetState();
    renderWallet();
    emit();
    toast('success', 'Wallet hidden on this site. Disconnect in your wallet app to fully revoke access.', 3600);
  }

  function requireWallet() {
    if (!state.address) { toast('error', 'Connect your wallet first.'); connect(false); return false; }
    if (!state.contract) { toast('error', 'Contract address is not set. Update js/config.js.'); return false; }
    if (state.chainId !== C.CHAIN_ID) {
      toast('error', 'Your wallet is on the wrong network. Approve the switch to Sepolia, then try again.');
      switchNetwork().catch(() => {});
      return false;
    }
    return true;
  }

  /* Runs a write transaction with consistent pending / success / error states.
     Pass success:null to skip the built-in success notice. */
  async function runTx(opts) {
    if (!requireWallet()) return null;
    setBusy(opts.btn, true);
    try {
      notice(opts.out, 'pending', opts.pending || 'Confirm the transaction in your wallet…');
      const tx = await opts.send(state.contract);
      notice(opts.out, 'pending', 'Transaction sent. Waiting for confirmation…', { tx: tx.hash });
      const receipt = await tx.wait();
      if (opts.success !== null) notice(opts.out, 'ok', opts.success || 'Transaction confirmed.', { tx: tx.hash });
      return receipt;
    } catch (e) {
      notice(opts.out, 'err', parseError(e));
      return null;
    } finally {
      setBusy(opts.btn, false);
    }
  }

  function hasRole(key) { return !!(state.roles && state.roles[key]); }

  /* Shows whether the connected wallet has the role a page needs.
     roleKeys: 'manufacturer' or 'collector|admin' (any of). */
  function roleNotice(el, roleKeys, label, purpose) {
    el = getEl(el);
    if (!el) return;
    el.dataset.keep = 'role-note';
    if (!state.address) {
      notice(el, 'info', `Connect a wallet with the ${label} role to ${purpose}.`);
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'link-btn'; b.dataset.connect = '1'; b.textContent = 'Connect wallet';
      el.append(b);
      return;
    }
    if (state.chainId !== C.CHAIN_ID) { notice(el, 'warn', 'Your wallet is on the wrong network. Switch to Sepolia to continue.'); return; }
    if (!state.roles) { el.hidden = true; return; }
    const ok = roleKeys.split('|').some((k) => state.roles[k]);
    if (ok) notice(el, 'ok', `${label} access confirmed for ${shortAddr(state.address)}.`);
    else notice(el, 'warn', `${shortAddr(state.address)} does not have the ${label} role, so transactions here will be rejected. Ask an admin to grant it.`);
  }

  /* ---------- Chrome: header, footer, wallet menu ---------- */
  function buildChrome() {
    const page = document.body.dataset.page;
    const header = $('#site-header');
    if (header) {
      header.innerHTML = `
      <div class="site-header" id="siteHeader">
        <div class="container nav-inner">
          <a class="brand" href="index.html" aria-label="E-Waste Tracker home">${LOGO}<span class="brand-text">E-Waste Tracker</span></a>
          <nav class="nav-links" id="navLinks" aria-label="Main">
            ${NAV.map((n) => `<a href="${n.href}"${n.id === page ? ' aria-current="page"' : ''}>${n.label}</a>`).join('')}
          </nav>
          <div class="nav-actions">
            <button class="chain-pill" id="chainPill" type="button" hidden></button>
            <div class="wallet">
              <button class="btn btn-primary btn-sm" id="walletBtn" type="button" aria-haspopup="true" aria-expanded="false">Connect wallet</button>
              <div class="wallet-menu" id="walletMenu" hidden></div>
            </div>
            <button class="icon-btn" id="themeBtn" type="button" aria-label="Switch colour theme"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 4a8 8 0 0 0 0 16z" fill="currentColor"/></svg></button>
            <button class="icon-btn nav-toggle" id="navToggle" type="button" aria-expanded="false" aria-controls="navLinks" aria-label="Open menu"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg></button>
          </div>
        </div>
      </div>`;
    }
    const footer = $('#site-footer');
    if (footer) {
      footer.innerHTML = `
      <footer class="site-footer">
        <div class="container footer-grid">
          <div>
            <a class="brand" href="index.html">${LOGO}<span>E-Waste Tracker</span></a>
            <p>Follow electronics from the factory floor to the recycling plant, with every hand-off recorded on the Sepolia test network.</p>
          </div>
          <nav aria-label="Footer"><h4>Pages</h4><div class="footer-links">${NAV.map((n) => `<a href="${n.href}">${n.label}</a>`).join('')}</div></nav>
          <div>
            <h4>Smart contract</h4>
            <div class="footer-links">
              <a class="mono" href="${C.EXPLORER}/address/${C.CONTRACT_ADDRESS}" target="_blank" rel="noopener">${shortAddr(C.CONTRACT_ADDRESS)}</a>
              <span>Sepolia test network. Test ETH has no real value.</span>
            </div>
          </div>
        </div>
        <div class="container footer-base">© ${new Date().getFullYear()} E-Waste Tracker</div>
      </footer>`;
    }
  }

  function renderWallet() {
    const btn = $('#walletBtn'), pill = $('#chainPill'), menu = $('#walletMenu');
    if (!btn) return;
    if (!state.address) {
      btn.className = 'btn btn-primary btn-sm';
      btn.textContent = 'Connect wallet';
      btn.setAttribute('aria-expanded', 'false');
      pill.hidden = true;
      menu.hidden = true;
      return;
    }
    const ok = state.chainId === C.CHAIN_ID;
    btn.className = 'btn btn-sm is-connected';
    btn.innerHTML = `<span class="dot${ok ? ' dot-live' : ''}" style="${ok ? '' : 'background:var(--gold)'}"></span>${escapeHtml(shortAddr(state.address))}`;
    pill.hidden = false;
    pill.className = 'chain-pill ' + (ok ? 'is-ok' : 'is-bad');
    pill.textContent = ok ? C.CHAIN_NAME : 'Wrong network. Switch';
    pill.disabled = ok;

    const chips = state.roles
      ? (Object.keys(ROLE_LABELS).filter((k) => state.roles[k]).map((k) => `<span class="chip on">${ROLE_LABELS[k]}</span>`).join('') || '<span class="chip off">No role assigned</span>')
      : '<span class="chip off">Roles unavailable</span>';
    menu.innerHTML = `
      <p class="wm-label">Connected wallet</p>
      <p class="wm-addr mono">${escapeHtml(state.address)}</p>
      <div class="wm-actions">
        <button type="button" class="link-btn" data-copy="${escapeHtml(state.address)}">Copy address</button>
        <a href="${C.EXPLORER}/address/${state.address}" target="_blank" rel="noopener">Etherscan</a>
      </div>
      <p class="wm-label">Your roles</p>
      <div class="chips">${chips}</div>
      ${ok ? '' : '<button type="button" class="btn btn-gold btn-sm btn-block" id="walletSwitch">Switch to Sepolia</button>'}
      <button type="button" class="btn btn-outline btn-sm btn-block" id="walletForget">Hide wallet on this site</button>`;
    const sw = $('#walletSwitch'); if (sw) sw.addEventListener('click', () => switchNetwork().catch((e) => toast('error', parseError(e))));
    $('#walletForget').addEventListener('click', forgetWallet);
  }

  function bindChrome() {
    const header = $('#siteHeader');
    const toggle = $('#navToggle');
    const setNav = (open) => {
      header.classList.toggle('nav-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    };
    toggle.addEventListener('click', () => setNav(!header.classList.contains('nav-open')));
    $$('#navLinks a').forEach((a) => a.addEventListener('click', () => setNav(false)));
    window.addEventListener('resize', () => { if (window.innerWidth > 1100) setNav(false); });

    const walletBtn = $('#walletBtn'), menu = $('#walletMenu');
    walletBtn.addEventListener('click', () => {
      if (!state.address) { connect(false); return; }
      menu.hidden = !menu.hidden;
      walletBtn.setAttribute('aria-expanded', menu.hidden ? 'false' : 'true');
    });
    $('#chainPill').addEventListener('click', () => switchNetwork().catch((e) => toast('error', parseError(e))));

    document.addEventListener('click', (e) => {
      if (!menu.hidden && !e.target.closest('.wallet')) { menu.hidden = true; walletBtn.setAttribute('aria-expanded', 'false'); }
      if (header.classList.contains('nav-open') && !e.target.closest('#siteHeader')) setNav(false);
      const c = e.target.closest('[data-copy]'); if (c) copyText(c.dataset.copy);
      const k = e.target.closest('[data-connect]'); if (k) connect(false);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      setNav(false);
      if (!menu.hidden) { menu.hidden = true; walletBtn.setAttribute('aria-expanded', 'false'); walletBtn.focus(); }
    });

    $('#themeBtn').addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      store.set('ew_theme', next);
    });
  }

  /* ---------- Boot ---------- */
  function init() {
    buildChrome();
    bindChrome();
    $$('.tilt').forEach((el) => initTilt(el));

    if (typeof ethers === 'undefined') {
      toast('error', 'The blockchain library failed to load. Check your connection and reload the page.', 8000);
      state.ready = true; emit();
      return;
    }
    if (!ethers.isAddress(C.CONTRACT_ADDRESS)) toast('error', 'CONTRACT_ADDRESS in js/config.js is not a valid address.', 8000);

    if (window.ethereum && window.ethereum.on) {
      window.ethereum.on('accountsChanged', (accs) => {
        if (store.get('ew_connected') !== '1') return;
        if (!accs || !accs.length) { resetState(); renderWallet(); emit(); } else { connect(true); }
      });
      window.ethereum.on('chainChanged', () => { if (store.get('ew_connected') === '1') connect(true); });
    }

    (async () => {
      if (store.get('ew_connected') === '1') await connect(true);
      state.ready = true;
      emit();
    })();
  }

  window.EW = {
    config: C, state, $, $$, reduceMotion,
    escapeHtml, shortAddr, shortHash, statusLabel, toTimestamp, fmtDate, fmtDay, isZeroAddr,
    monoCopy, addrHtml, stepsHtml, parseError, notice, clearNotice, toast, setBusy, copyText,
    countUp, initTilt, reader, viewer, iface: iface_, connect, switchNetwork, requireWallet, runTx,
    onChange, hasRole, roleNotice, store
  };

  init();
})();