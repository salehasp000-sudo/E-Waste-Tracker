/* Transfer page: two-step ownership hand-off with helpful hints */
(function () {
  'use strict';
  const { $, notice, runTx, shortAddr, isZeroAddr } = EW;
  const validId = (v) => /^\d+$/.test(v) && v !== '0';
  const sameAddr = (a, b) => a && b && a.toLowerCase() === b.toLowerCase();

  /* ---------- Hints ---------- */
  async function ownerHint() {
    const id = $('#transferDeviceId').value.trim(), el = $('#ownerHint');
    if (!validId(id)) { el.textContent = ''; return; }
    try {
      const d = await EW.reader().getDeviceById(id);
      if (!d.exists) { el.textContent = 'No device with that ID.'; return; }
      const you = sameAddr(d.currentOwner, EW.state.address);
      el.textContent = `Current owner: ${shortAddr(d.currentOwner)}${you ? ' (this wallet)' : EW.state.address ? '. This wallet is not the owner, so the offer will be rejected.' : ''}`;
    } catch (e) { el.textContent = ''; }
  }

  async function pendingHint() {
    const id = $('#acceptDeviceId').value.trim(), el = $('#pendingHint');
    if (!validId(id)) { el.textContent = ''; return; }
    try {
      const r = await EW.reader().transferRequests(id);
      if (!r.pending) { el.textContent = 'No transfer is waiting for this device.'; return; }
      const you = sameAddr(r.to, EW.state.address);
      el.textContent = `Offered by ${shortAddr(r.from)} to ${shortAddr(r.to)}${you ? ' (this wallet)' : EW.state.address ? '. This wallet is not the recipient.' : ''}.`;
    } catch (e) { el.textContent = ''; }
  }

  $('#transferDeviceId').addEventListener('change', ownerHint);
  $('#acceptDeviceId').addEventListener('change', pendingHint);
  EW.onChange(() => { ownerHint(); pendingHint(); });

  /* ---------- Step 1: offer ---------- */
  $('#offerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = $('#transferDeviceId').value.trim();
    const to = $('#transferNewOwner').value.trim();
    if (!validId(id)) { notice('offerMsg', 'err', 'Enter a valid device ID.'); return; }
    if (!ethers.isAddress(to) || isZeroAddr(to)) { notice('offerMsg', 'err', 'Enter a valid wallet address for the new owner (starts with 0x, 42 characters).'); return; }
    const receipt = await runTx({
      btn: $('#offerBtn'), out: 'offerMsg',
      success: 'Transfer offered. The new owner now needs to accept it.',
      send: (c) => c.initiateOwnershipTransfer(id, to)
    });
    if (receipt) { $('#acceptDeviceId').value = id; pendingHint(); }
  });

  /* ---------- Step 2: accept ---------- */
  $('#acceptForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = $('#acceptDeviceId').value.trim();
    if (!validId(id)) { notice('acceptMsg', 'err', 'Enter a valid device ID.'); return; }
    const receipt = await runTx({
      btn: $('#acceptBtn'), out: 'acceptMsg',
      success: 'Transfer accepted. You are now the owner.',
      send: (c) => c.acceptOwnershipTransfer(id)
    });
    if (receipt) pendingHint();
  });
})();
