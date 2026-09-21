/* Register page: device registration (step 1) and QR generation (step 2) */
(function () {
  'use strict';
  const { $, notice, runTx, escapeHtml, toTimestamp, parseError, store } = EW;
  const RECENT_KEY = 'ew_recent_devices';

  $('#regDate').max = new Date().toISOString().slice(0, 10);
  EW.onChange(() => EW.roleNotice('registerRole', 'manufacturer', 'Manufacturer', 'register devices'));

  /* ---------- Recent registrations (kept in this browser only) ---------- */
  function loadRecent() { try { return JSON.parse(store.get(RECENT_KEY) || '[]'); } catch (e) { return []; } }
  function saveRecent(item) {
    const list = loadRecent().filter((r) => r.id !== item.id);
    list.unshift(item);
    store.set(RECENT_KEY, JSON.stringify(list.slice(0, 5)));
    renderRecent();
  }
  function renderRecent() {
    const list = loadRecent();
    $('#recentBox').hidden = !list.length;
    $('#recentList').innerHTML = list.map((r) =>
      `<li><span><strong>#${escapeHtml(r.id)}</strong> ${escapeHtml(r.type)}<br><span class="muted mono">${escapeHtml(r.serial)}</span></span>
       <button class="btn btn-outline btn-sm" type="button" data-qr-for="${escapeHtml(r.id)}">QR code</button></li>`).join('');
  }
  $('#recentList').addEventListener('click', (e) => {
    const b = e.target.closest('[data-qr-for]');
    if (b) goToQr(b.dataset.qrFor);
  });

  function goToQr(id) {
    $('#qrDeviceId').value = id;
    $('#qrPanel').scrollIntoView({ behavior: EW.reduceMotion ? 'auto' : 'smooth', block: 'start' });
    $('#qrDeviceId').focus({ preventScroll: true });
  }

  /* ---------- Step 1: register ---------- */
  $('#registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const type = $('#regType').value.trim();
    const manu = $('#regManuName').value.trim();
    const date = toTimestamp($('#regDate').value);
    const serial = $('#regSerial').value.trim();
    if (!type || !manu || !serial || !date) { notice('regMsg', 'err', 'Fill in every field, including the date of manufacture.'); return; }

    const receipt = await runTx({
      btn: $('#regBtn'), out: 'regMsg', success: null,
      send: (c) => c.registerDevice(type, manu, date, serial)
    });
    if (!receipt) return;

    // The contract assigns the ID; read it back from the DeviceRegistered event.
    let id = null;
    for (const log of receipt.logs) {
      try {
        const parsed = EW.iface().parseLog(log);
        if (parsed && parsed.name === 'DeviceRegistered') { id = parsed.args.deviceId.toString(); break; }
      } catch (err) { /* not one of ours */ }
    }
    if (id) {
      notice('regMsg', 'ok', `Device registered with ID ${id}.`, { tx: receipt.hash });
      $('#regNewId').textContent = '#' + id;
      $('#regResult').hidden = false;
      $('#qrDeviceId').value = id;
      $('#toQrBtn').onclick = () => goToQr(id);
      saveRecent({ id: id, type: type, serial: serial });
      $('#registerForm').reset();
    } else {
      notice('regMsg', 'ok', 'Device registered. Look up its ID on the Track page using the serial number.', { tx: receipt.hash });
    }
  });

  /* ---------- Step 2: QR ---------- */
  let lastLink = '';

  $('#qrForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = $('#qrDeviceId').value.trim();
    if (!/^\d+$/.test(id) || id === '0') { notice('qrMsg', 'err', 'Enter a valid device ID.'); return; }
    if (typeof QRCode === 'undefined') { notice('qrMsg', 'err', 'The QR library failed to load. Check your connection and reload.'); return; }
    if (!EW.requireWallet()) return;

    const hash = ethers.keccak256(ethers.toUtf8Bytes(`${id}-${Date.now()}-${EW.state.address}`));
    const receipt = await runTx({
      btn: $('#qrBtn'), out: 'qrMsg', success: null,
      send: (c) => c.generateQRCode(id, hash)
    });
    if (!receipt) return;
    notice('qrMsg', 'ok', 'QR code created and stored on-chain.', { tx: receipt.hash });
    renderQr(hash);
  });

  function renderQr(hash) {
    // The QR encodes a full link, so any phone camera opens the device page directly.
    const url = new URL('track.html', window.location.href);
    url.search = '';
    url.hash = '';
    url.searchParams.set('qr', hash);
    lastLink = url.href;

    const holder = $('#qrCanvas');
    holder.innerHTML = '';
    new QRCode(holder, { text: lastLink, width: 220, height: 220, colorDark: '#0b2b26', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M });
    $('#qrLink').textContent = lastLink;
    $('#qrOpen').href = lastLink;
    $('#qrCard').hidden = false;

    const local = /^(localhost|127\.|0\.0\.0\.0)/.test(location.hostname) || location.protocol === 'file:';
    const note = $('#qrHostNote');
    note.hidden = !local;
    if (local) note.textContent = 'This link points at your own computer. Deploy the site (Vercel, Netlify or GitHub Pages) before printing labels so phones can open it.';
    $('#qrCard').scrollIntoView({ behavior: EW.reduceMotion ? 'auto' : 'smooth', block: 'nearest' });
  }

  $('#qrDownload').addEventListener('click', () => {
    const src = $('#qrCanvas canvas');
    if (!src) { notice('qrMsg', 'err', 'Could not read the QR image. Right-click it and save instead.'); return; }
    const pad = 24, out = document.createElement('canvas');
    out.width = src.width + pad * 2; out.height = src.height + pad * 2;
    const ctx = out.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(src, pad, pad);
    const a = document.createElement('a');
    a.download = `device-${$('#qrDeviceId').value || 'qr'}-qr.png`;
    a.href = out.toDataURL('image/png');
    a.click();
  });
  $('#qrCopy').addEventListener('click', () => EW.copyText(lastLink));

  renderRecent();
})();
