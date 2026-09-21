/* Lifecycle page: status updates with a live preview of the device's current step */
(function () {
  'use strict';
  const { $, escapeHtml, notice, runTx, statusLabel, stepsHtml, addrHtml, parseError } = EW;

  // Which role the contract expects for each target status
  const ROLE_FOR = {
    3: { keys: 'collector', label: 'Collector' },
    4: { keys: 'recycler', label: 'Recycler' },
    5: { keys: 'recycler', label: 'Recycler' },
    6: { keys: 'admin', label: 'Admin' }
  };
  const CID = /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{50,})$/;

  function refreshRoleNote() {
    const r = ROLE_FOR[$('#newStatus').value];
    EW.roleNotice('lifecycleRole', r.keys, r.label, 'set this status');
  }
  EW.onChange(refreshRoleNote);
  $('#newStatus').addEventListener('change', refreshRoleNote);

  /* ---------- Device preview ---------- */
  let previewTimer = 0;
  $('#statusDeviceId').addEventListener('input', () => { clearTimeout(previewTimer); previewTimer = setTimeout(preview, 450); });

  async function preview() {
    const box = $('#devicePreview');
    const id = $('#statusDeviceId').value.trim();
    if (!/^\d+$/.test(id) || id === '0') {
      box.innerHTML = '<div class="empty-state"><strong>No device selected</strong><span>Its progress appears here.</span></div>';
      return;
    }
    box.innerHTML = '<div class="skeleton" style="height:140px"></div>';
    try {
      const d = await EW.reader().getDeviceById(id);
      if (!d.exists) throw new Error('No device with ID ' + id + '.');
      const cur = Number(d.status);
      const next = cur + 1;
      let hint;
      if (next <= 6) {
        hint = `Next step: <strong>${escapeHtml(statusLabel(next))}</strong>.`;
        if (next >= 3) $('#newStatus').value = String(next);
        else hint += ' Collection can only start after the device has been sold to a consumer.';
        refreshRoleNote();
      } else {
        hint = 'This record is closed. No further updates are possible.';
      }
      box.innerHTML = `
        <div class="preview" style="margin-top:0">
          <h3>${escapeHtml(d.deviceType)} #${escapeHtml(d.id.toString())}</h3>
          <p>${escapeHtml(d.manufacturerName)}, serial <span class="mono">${escapeHtml(d.serialNumber)}</span></p>
          ${stepsHtml(cur)}
        </div>
        <p style="margin:16px 0 8px">${hint}</p>
        <p class="muted" style="margin:0;font-size:.88rem">Current owner: ${addrHtml(d.currentOwner)}</p>`;
    } catch (e) {
      box.innerHTML = `<div class="notice notice-err" style="margin:0">${escapeHtml(parseError(e))}</div>`;
    }
  }

  /* ---------- Submit ---------- */
  $('#statusForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = $('#statusDeviceId').value.trim();
    const status = Number($('#newStatus').value);
    const ipfs = $('#statusIpfs').value.trim();
    if (!/^\d+$/.test(id) || id === '0') { notice('statusMsg', 'err', 'Enter a valid device ID.'); return; }
    if (ipfs && !CID.test(ipfs)) { notice('statusMsg', 'err', 'That does not look like an IPFS hash. It should start with Qm or bafy.'); return; }

    const receipt = await runTx({
      btn: $('#statusBtn'), out: 'statusMsg',
      success: 'Status updated to ' + statusLabel(status) + '.',
      send: (c) => c.updateStatus(id, status, ipfs)
    });
    if (receipt) { $('#statusIpfs').value = ''; preview(); }
  });
})();
