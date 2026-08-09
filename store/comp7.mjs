import { chromium } from "playwright";
const b = await chromium.connectOverCDP("http://localhost:9222");
const p = b.contexts()[0].pages().at(-1);
p.on('dialog', d => d.accept().catch(()=>{}));

for (let step = 0; step < 8; step++) {
  const has = await p.locator('[role=dialog]').count();
  if (!has) { console.log(`step ${step}: dialog closed`); break; }
  const txt = (await p.locator('[role=dialog]').innerText()).replace(/\s+/g,' ');
  console.log(`\nstep ${step}: ${txt.slice(0,180)}`);

  if (/what type of encryption algorithms/i.test(txt)) {
    await p.locator('#encryptionCheck_standardEncryption').check();   // real events
    console.log("  checked: standard encryption");
  } else {
    // Exemption step — prefer the open-source / publicly-available basis.
    const labels = await p.locator('[role=dialog] input[type=radio]').evaluateAll(rs =>
      rs.map(r => ({ id: r.id, label: (r.closest('label,li,div')?.innerText||'').replace(/\s+/g,' ').slice(0,120) })));
    console.log("  options:", JSON.stringify(labels, null, 1));
    const oss = labels.find(l => /open source|publicly available|general public/i.test(l.label));
    const yes = labels.find(l => /^yes/i.test(l.label.trim()));
    const target = oss || yes;
    if (target?.id) { await p.locator('#' + target.id).check(); console.log("  checked:", target.label.slice(0,70)); }
    else { console.log("  no option matched — stopping"); break; }
  }
  await p.waitForTimeout(2000);
  const nx = p.locator('[role=dialog] button', { hasText: /^(Next|Save|Done|Submit)$/ }).first();
  if (await nx.count() && await nx.isEnabled()) {
    const l = (await nx.innerText()).trim();
    await nx.click();
    console.log("  clicked:", l);
  } else { console.log("  advance button still disabled"); break; }
  await p.waitForTimeout(7000);
}
const t = await p.evaluate(() => document.body.innerText.replace(/\s+/g,' '));
console.log("\nstill missing compliance:", /missing compliance/i.test(t));
await p.screenshot({ path: process.env.HOME + '/Desktop/clim-asc-shots/compliance-done.png' });
await b.close();
