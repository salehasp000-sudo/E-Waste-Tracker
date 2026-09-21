/* Track page: public device lookup (ID, QR hash, camera) and passport rendering */
(function () {
  'use strict';
  const { $, $$, escapeHtml, notice, clearNotice, parseError, fmtDate, fmtDay, statusLabel, stepsHtml, addrHtml, monoCopy, shortHash } = EW;
  const out = $('#deviceResult');
  let scanner = null;

  /* ---------- Tabs ---------- */
  const tabs = $$('.tab');
  function selectTab(id) {
    tabs.forEach((t) => { const on = t.dataset.tab === id; t.setAttribute('aria-selected', on ? 'true' : 'false'); t.tabIndex = on ? 0 : -1; });
    $$('.tabpanel').forEach((p) => { p.hidden = p.id !== 'tab-' + id; });
    if (id !== 'scan') stopScanner();
    clearNotice('lookupMsg');
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => selectTab(t.dataset.tab));
    t.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      next.focus(); selectTab(next.dataset.tab);
    });
  });

  /* ---------- Lookup ---------- */
  function extractHash(text) {
    text = String(text || '').trim();
    try { const p = new URL(text).searchParams.get('qr'); if (p) return p; } catch (e) { /* raw hash */ }
    return text;
  }

  function showLoading() { out.innerHTML = '<div class="skeleton" aria-label="Loading device"></div>'; }
  function showEmpty() {
    out.innerHTML = '<div class="empty-state"><strong>Nothing to show</strong><span>Check the ID or QR code and try again.</span></div>';
  }

  async function lookup(by, raw) {
    let value = String(raw || '').trim();
    if (by === 'id' && !/^\d+$/.test(value)) { notice('lookupMsg', 'err', 'Enter the device ID as a whole number.'); return; }
    if (by === 'qr') value = extractHash(value);
    if (!value) { notice('lookupMsg', 'err', 'Enter a QR hash or paste the QR link.'); return; }

    clearNotice('lookupMsg');
    showLoading();
    try {
      const c = EW.reader();
      const d = by === 'id' ? await c.getDeviceById(value) : await c.getDeviceByQR(value);
      if (!d.exists) throw new Error('No registered device matches that ' + (by === 'id' ? 'ID' : 'QR code') + '.');
      const [hist, owners] = await Promise.allSettled([c.getDeviceHistory(d.id), c.getOwnershipHistory(d.id)]);
      renderPassport(d, hist.status === 'fulfilled' ? hist.value : [], owners.status === 'fulfilled' ? owners.value : []);
      notice('lookupMsg', 'ok', 'Device found.');
    } catch (e) {
      showEmpty();
      notice('lookupMsg', 'err', by === 'qr' ? 'This QR code does not match any registered device.' : parseError(e));
    }
  }

  function shareLink(d) {
    const u = new URL(window.location.href);
    u.search = ''; u.hash = '';
    if (d.qrCodeHash) u.searchParams.set('qr', d.qrCodeHash); else u.searchParams.set('id', d.id.toString());
    return u.href;
  }

  function renderPassport(d, hist, owners) {
    const status = Number(d.status);
    const link = shareLink(d);

    const timeline = hist.length
      ? '<ol class="timeline">' + hist.map((h) => {
        const cid = h.ipfsDocHash ? `<a href="https://ipfs.io/ipfs/${encodeURIComponent(h.ipfsDocHash)}" target="_blank" rel="noopener">View supporting document</a>` : '';
        return `<li><span class="tl-dot"></span><strong>${escapeHtml(statusLabel(h.status))}</strong><span class="muted">${escapeHtml(fmtDate(h.timestamp))} by ${escapeHtml(EW.shortAddr(h.updatedBy))}</span>${cid}</li>`;
      }).join('') + '</ol>'
      : '<p class="muted">No status updates recorded yet.</p>';

    const ownerRows = owners.length
      ? `<div class="table-wrap"><table class="data"><thead><tr><th>From</th><th>To</th><th>When</th></tr></thead><tbody>${owners.map((o) =>
        `<tr><td>${addrHtml(o.from)}</td><td>${addrHtml(o.to)}</td><td>${escapeHtml(fmtDate(o.timestamp))}</td></tr>`).join('')}</tbody></table></div>`
      : '<p class="muted">Ownership has not changed since registration.</p>';

    out.innerHTML = `
      <article class="passport tilt" data-tilt="2.5">
        <header class="passport-head">
          <div><h2>${escapeHtml(d.deviceType)}</h2><p>Device #${escapeHtml(d.id.toString())} by ${escapeHtml(d.manufacturerName)}</p></div>
          <span class="pill pill-s${status}">${escapeHtml(statusLabel(status))}</span>
        </header>
        ${stepsHtml(status)}
        <dl class="facts">
          <div><dt>Serial number</dt><dd class="mono">${escapeHtml(d.serialNumber)}</dd></div>
          <div><dt>Date of manufacture</dt><dd>${escapeHtml(fmtDay(d.dateOfManufacture))}</dd></div>
          <div><dt>Manufacturer wallet</dt><dd>${addrHtml(d.manufacturer)}</dd></div>
          <div><dt>Current owner</dt><dd>${addrHtml(d.currentOwner)}</dd></div>
          <div class="wide"><dt>QR hash</dt><dd>${d.qrCodeHash ? monoCopy(d.qrCodeHash, shortHash(d.qrCodeHash)) : '<span class="muted">Not generated yet</span>'}</dd></div>
        </dl>
        ${d.qrCodeHash ? `
        <div class="passport-qr">
          <div class="qr-frame" id="passportQr"></div>
          <div><p>Share or reprint this device's label.</p>
            <div class="btn-row" style="margin:0"><button class="btn btn-outline btn-sm" type="button" data-copy="${escapeHtml(link)}">Copy share link</button></div></div>
        </div>` : ''}
        <h3>Status history</h3>${timeline}
        <h3>Ownership history</h3>${ownerRows}
      </article>`;

    const qrEl = $('#passportQr');
    if (qrEl && typeof QRCode !== 'undefined') {
      new QRCode(qrEl, { text: link, width: 120, height: 120, colorDark: '#0b2b26', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M });
    }
    EW.initTilt($('.passport', out));
    if (window.innerWidth < 900) out.scrollIntoView({ behavior: EW.reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }

  $('#tab-id').addEventListener('submit', (e) => { e.preventDefault(); lookup('id', $('#lookupId').value); });
  $('#tab-qr').addEventListener('submit', (e) => { e.preventDefault(); lookup('qr', $('#lookupQr').value); });

  /* ---------- Camera scanner ---------- */
  async function startScanner() {
    if (typeof Html5Qrcode === 'undefined') { notice('scanMsg', 'err', 'The scanner library failed to load. Use the Device ID tab instead.'); return; }
    if (!window.isSecureContext) {
      notice('scanMsg', 'err', 'Camera access needs HTTPS or localhost. Host the site (Vercel, Netlify) or run it through a local server.');
      return;
    }
    $('#qrReader').innerHTML = '';
    scanner = new Html5Qrcode('qrReader');
    try {
      await scanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 240, height: 240 } }, onScan, () => {});
      $('#startScanBtn').hidden = true;
      $('#stopScanBtn').hidden = false;
      notice('scanMsg', 'pending', 'Point the camera at a device QR code…');
    } catch (e) {
      scanner = null;
      notice('scanMsg', 'err', 'Could not start the camera: ' + parseError(e) + ' Allow camera permission and try again.');
    }
  }

  async function stopScanner() {
    if (scanner) {
      try { await scanner.stop(); scanner.clear(); } catch (e) { /* already stopped */ }
      scanner = null;
    }
    $('#startScanBtn').hidden = false;
    $('#stopScanBtn').hidden = true;
    clearNotice('scanMsg');
  }

  async function onScan(text) {
    await stopScanner();
    const hash = extractHash(text);
    $('#lookupQr').value = hash;
    notice('scanMsg', 'ok', 'QR code read. Looking up the device…');
    lookup('qr', hash);
  }

  $('#startScanBtn').addEventListener('click', startScanner);
  $('#stopScanBtn').addEventListener('click', stopScanner);

  /* ---------- Opened from a QR link (?qr=… or ?id=…) ---------- */
  const params = new URLSearchParams(window.location.search);
  if (params.get('qr')) { selectTab('qr'); $('#lookupQr').value = params.get('qr'); lookup('qr', params.get('qr')); }
  else if (params.get('id')) { selectTab('id'); $('#lookupId').value = params.get('id'); lookup('id', params.get('id')); }
})();
