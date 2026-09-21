/* Admin page: grant / revoke roles and inspect a wallet's roles */
(function () {
  'use strict';
  const { $, notice, runTx, parseError, shortAddr } = EW;
  const ROLE_NAMES = ['Admin', 'Manufacturer', 'Collector', 'Recycler', 'Regulator'];
  const ROLE_LABEL = { MANUFACTURER_ROLE: 'Manufacturer', COLLECTOR_ROLE: 'Collector', RECYCLER_ROLE: 'Certified recycler', REGULATOR_ROLE: 'Regulator' };

  EW.onChange(() => EW.roleNotice('adminRole', 'admin', 'Admin', 'grant or revoke roles'));

  async function change(kind) {
    const roleName = $('#roleSelect').value;
    const addr = $('#roleAddress').value.trim();
    if (!ethers.isAddress(addr)) { notice('roleMsg', 'err', 'Enter a valid wallet address (0x…).'); return; }
    if (!EW.requireWallet()) return;

    let roleHash;
    try { roleHash = await EW.reader()[roleName](); }
    catch (e) { notice('roleMsg', 'err', parseError(e)); return; }

    const grant = kind === 'grant';
    const receipt = await runTx({
      btn: $(grant ? '#grantBtn' : '#revokeBtn'), out: 'roleMsg',
      success: `${ROLE_LABEL[roleName]} role ${grant ? 'granted to' : 'revoked from'} ${shortAddr(addr)}.`,
      send: (c) => (grant ? c.grantRole(roleHash, addr) : c.revokeRole(roleHash, addr))
    });
    if (receipt && $('#checkAddress').value.trim().toLowerCase() === addr.toLowerCase()) $('#checkForm').requestSubmit();
  }

  $('#roleForm').addEventListener('submit', (e) => { e.preventDefault(); change('grant'); });
  $('#revokeBtn').addEventListener('click', () => change('revoke'));

  $('#checkForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const addr = $('#checkAddress').value.trim() || EW.state.address;
    if (!addr) { notice('roleCheckMsg', 'err', 'Enter a wallet address, or connect your wallet.'); return; }
    if (!ethers.isAddress(addr)) { notice('roleCheckMsg', 'err', 'That is not a valid wallet address.'); return; }
    EW.setBusy($('#checkBtn'), true);
    try {
      const r = await EW.viewer().getUserRoles(addr);
      const active = ROLE_NAMES.filter((n, i) => r[i]);
      notice('roleCheckMsg', 'info', active.length ? `${shortAddr(addr)} holds ${active.length} role${active.length === 1 ? '' : 's'}.` : `${shortAddr(addr)} has no role assigned.`);
      $('#roleChips').innerHTML = ROLE_NAMES.map((n, i) => `<span class="chip ${r[i] ? 'on' : 'off'}">${n}</span>`).join('');
    } catch (err) { notice('roleCheckMsg', 'err', parseError(err)); }
    finally { EW.setBusy($('#checkBtn'), false); }
  });
})();