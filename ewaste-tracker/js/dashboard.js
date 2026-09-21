/* Dashboard page: regulator-only. Every figure is read with the connected
   wallet as the caller, so the contract itself decides who may see it. */
(function () {
  'use strict';
  const { $, parseError, escapeHtml, shortAddr } = EW;
  const C = EW.config;
  const KEYS = ['Registered', 'Collected', 'Recycled', 'Disposed'];
  let loading = false;
  let unlocked = false;
  let timer = 0;

  /* ---------- Access gate ---------- */
  function lock(title, text, action) {
    unlocked = false;
    clearInterval(timer);
    $('#dashContent').hidden = true;
    $('#dashLocked').hidden = false;
    $('#lockTitle').textContent = title;
    $('#lockText').textContent = text;
    const box = $('#lockActions');
    box.innerHTML = '';
    if (action === 'connect') {
      box.innerHTML = '<button type="button" class="btn btn-primary" data-connect="1">Connect wallet</button>';
    } else if (action === 'switch') {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'btn btn-gold'; b.textContent = 'Switch to Sepolia';
      b.addEventListener('click', () => EW.switchNetwork().catch((e) => EW.toast('error', parseError(e))));
      box.appendChild(b);
    }
  }

  function unlock() {
    $('#dashLocked').hidden = true;
    $('#dashContent').hidden = false;
    if (!unlocked) {
      unlocked = true;
      clearInterval(timer);
      timer = setInterval(() => { if (!document.hidden) load(); }, 30000);
    }
    load();
  }

  EW.onChange((s) => {
    if (!s.connected) return lock('Regulator access only', 'Connect a wallet that holds the Regulator role to see these figures.', 'connect');
    if (!s.onSepolia) return lock('Wrong network', 'Switch your wallet to Sepolia to continue.', 'switch');
    if (!s.roles) return lock('Could not verify your role', 'The contract did not return your roles. Check your connection and reload.');
    if (!s.roles.regulator) {
      return lock('Regulator access only', `${shortAddr(s.address)} does not hold the Regulator role. Ask an admin to grant it, then reload this page.`);
    }
    unlock();
  });

  /* ---------- Totals ---------- */
  async function load() {
    if (loading || !unlocked) return;
    loading = true;
    const btn = $('#refreshBtn');
    EW.setBusy(btn, true);
    try {
      const r = await EW.viewer().getDashboardStats();
      const vals = [r[0], r[1], r[2], r[3]].map(Number);
      const max = Math.max(vals[0], 1);
      KEYS.forEach((k, i) => {
        EW.countUp('stat' + k, vals[i], 700);
        $('#val' + k).textContent = vals[i].toLocaleString();
        $('#bar' + k).style.width = Math.min(100, (vals[i] / max) * 100) + '%';
      });
      const processed = vals[0] ? Math.round(((vals[2] + vals[3]) / vals[0]) * 100) : 0;
      $('#rateText').textContent = vals[0]
        ? `${processed}% of registered devices have been recycled or disposed.`
        : 'No devices are registered yet.';
      $('#dashSource').textContent = 'Live from the contract on Sepolia. Updated ' + new Date().toLocaleTimeString() + '.';
      const scene = EWScene.instances.sceneCanvas;
      if (scene && scene.setValues) scene.setValues(vals);
    } catch (e) {
      $('#dashSource').textContent = parseError(e);
    } finally {
      EW.setBusy(btn, false);
      loading = false;
    }
  }
  $('#refreshBtn').addEventListener('click', load);

  /* ---------- Devices by type ---------- */
  $('#typeForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const type = $('#filterType').value.trim();
    const el = $('#typeResult');
    el.hidden = false;
    if (!type) { el.textContent = 'Enter a device type, for example Laptop.'; return; }
    try {
      const n = await EW.viewer().getDeviceCountByType(type);
      el.innerHTML = `<strong>${escapeHtml(type)}</strong>: ${Number(n).toLocaleString()} device${Number(n) === 1 ? '' : 's'} registered.`;
    } catch (err) { el.textContent = parseError(err); }
  });

  /* ---------- Recycler activity ---------- */
  $('#recyclerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const addr = $('#recyclerAddr').value.trim();
    const el = $('#recyclerResult');
    el.hidden = false;
    if (!ethers.isAddress(addr)) { el.textContent = 'Enter a valid wallet address (0x…).'; return; }
    try {
      const n = await EW.viewer().getRecyclerActivity(addr);
      el.innerHTML = `<span class="mono">${escapeHtml(shortAddr(addr))}</span> has recorded ${Number(n).toLocaleString()} update${Number(n) === 1 ? '' : 's'}.`;
    } catch (err) { el.textContent = parseError(err); }
  });
})();