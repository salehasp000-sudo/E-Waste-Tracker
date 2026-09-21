/* Home page: live totals from the public counters (no wallet needed) */
(function () {
  'use strict';
  const { $ } = EW;
  const FIELDS = [
    ['statRegistered', 'totalRegisteredDevices'],
    ['statCollected', 'totalCollected'],
    ['statRecycled', 'totalRecycled'],
    ['statDisposed', 'totalDisposed']
  ];

  async function load() {
    const note = $('#statNote');
    try {
      const c = EW.reader();
      const values = await Promise.all(FIELDS.map((f) => c[f[1]]()));
      values.forEach((v, i) => EW.countUp(FIELDS[i][0], Number(v), 1100));
      note.textContent = 'Live from the smart contract on Sepolia.';
    } catch (e) {
      note.textContent = 'Could not read the contract. Check the address in js/config.js and your connection.';
    }
  }
  load();
})();
