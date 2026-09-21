# E-Waste Tracker (Sepolia dApp)

A multi-page front end for the `EWasteTracking` smart contract. Plain HTML, CSS and JavaScript. No build step.

## Structure

```
ewaste-tracker/
├── index.html        Home: 3D hero, live totals, lifecycle, roles
├── register.html     Register a device + generate its QR label   (Manufacturer)
├── track.html        Scan / look up a device, full passport        (Public)
├── lifecycle.html    Update lifecycle status                       (Collector / Recycler / Admin)
├── transfer.html     Two-step ownership transfer                   (Owner / New owner)
├── dashboard.html    Regulatory dashboard                          (Regulator)
├── admin.html        Grant / revoke / check roles                  (Admin)
├── css/style.css     Design tokens, components, responsive rules, dark mode
├── js/config.js      Contract address, network, ABI  <- edit this if you redeploy
├── js/app.js         Navbar, footer, wallet, roles, notices, transaction helper
├── js/scene.js       Three.js scenes (one per page)
├── js/<page>.js      One small script per page
└── assets/favicon.svg
```

## Run it locally

Browsers block wallet and camera features on `file://`, so serve the folder:

```bash
cd ewaste-tracker
python3 -m http.server 8080
# open http://localhost:8080
```

## Deploy

Drag the folder onto Netlify or Vercel, or push it to GitHub Pages. QR codes encode a link to
`track.html`, so **deploy before printing labels**, otherwise the QR links point at your own computer.
The camera scanner needs HTTPS (any of these hosts provides it).

## Changing the contract

Edit `CONTRACT_ADDRESS` (and the ABI if the contract changes) in `js/config.js`. Nothing else needs to change.

## Libraries (loaded from cdnjs)

ethers 6.13.2, three.js r128, qrcodejs 1.0.0, html5-qrcode 2.3.8.
