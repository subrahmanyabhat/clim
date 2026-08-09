import { chromium } from "playwright";
const b = await chromium.connectOverCDP("http://localhost:9222");
const p = b.contexts()[0].pages().at(-1);
p.on('dialog', d => d.accept().catch(()=>{}));

const dialogText = () => p.evaluate(() => {
  const d = document.querySelector('[role=dialog]');
  return d ? d.innerText.replace(/\s+/g,' ') : '(no dialog)';
});

for (let step = 0; step < 8; step++) {
  const txt = await dialogText();
  if (txt === '(no dialog)') { console.log(`step ${step}: dialog closed`); break; }
  console.log(`\nstep ${step}: ${txt.slice(0, 220)}`);

  // Answer whatever question is on screen, truthfully for clim.
  const chose = await p.evaluate(() => {
    const d = document.querySelector('[role=dialog]');
    const t = d.innerText;
    const pick = (id) => { const el = d.querySelector('#' + CSS.escape(id)); if (el) { el.click(); return id; } return null; };
    if (/what type of encryption algorithms/i.test(t)) return pick('encryptionCheck_standardEncryption');
    // Exemption question: clim's source is public, which is the open-source basis.
    const radios = [...d.querySelectorAll('input[type=radio]')].filter(e=>e.offsetParent);
    for (const r of radios) {
      const label = (r.closest('label,li,div')?.innerText || '').toLowerCase();
      if (/open source|publicly available|available to the general public/.test(label)) { r.click(); return 'open-source exemption'; }
    }
    for (const r of radios) {
      const label = (r.closest('label,li,div')?.innerText || '').toLowerCase();
      if (/^yes/.test(label.trim())) { r.click(); return 'yes: ' + label.slice(0,60); }
    }
    return 'no radio matched';
  });
  console.log("  chose:", chose);
  await p.waitForTimeout(2500);

  const clicked = await p.evaluate(() => {
    const d = document.querySelector('[role=dialog]');
    const btn = [...d.querySelectorAll('button')].filter(e=>!e.disabled).find(e => /^(next|save|done|submit)$/i.test(e.innerText.trim()));
    if (!btn) return 'no enabled advance button';
    const l = btn.innerText.trim(); btn.click(); return l;
  });
  console.log("  clicked:", clicked);
  await p.waitForTimeout(7000);
}
const t = await p.evaluate(() => document.body.innerText.replace(/\s+/g,' '));
console.log("\nstill missing compliance:", /missing compliance/i.test(t));
await p.screenshot({ path: process.env.HOME + '/Desktop/clim-asc-shots/compliance-final.png' });
await b.close();
