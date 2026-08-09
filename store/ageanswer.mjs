import { chromium } from "playwright";
const b = await chromium.connectOverCDP("http://localhost:9222");
const p = b.contexts()[0].pages().at(-1);
p.on('dialog', d => d.accept().catch(()=>{}));

// Truthful for clim: no browser, no UGC distribution, no user-to-user
// messaging (you talk to your own Mac), no ads, no parental controls.
const answers = {
  parentalControls: false, ageAssurance: false, unrestrictedWebAccess: false,
  userGeneratedContent: false, socialMedia: false, socialMediaAgeRestricted: false,
  messagingAndChat: false, advertising: false,
};
for (const [name, val] of Object.entries(answers)) {
  const id = `#${name}__${val}`;
  const el = p.locator(id);
  if (await el.count()) { await el.check().catch(()=>{}); console.log(`  ${name} = ${val}`); }
  else console.log(`  ${name}: control not found`);
}
await p.waitForTimeout(3000);

// Anything further down the form?
const more = await p.evaluate(() => {
  const names = [...new Set([...document.querySelectorAll('input[type=radio],select')].filter(e=>e.offsetParent).map(r=>r.name||r.id))];
  const t = document.body.innerText.replace(/\s+/g,' ');
  const i = t.search(/age rating|rating will be/i);
  return { controls: names, near: i>=0 ? t.slice(i, i+240) : '' };
});
console.log("\ncontrols now:", JSON.stringify(more.controls));
console.log("context:", more.near);
await p.screenshot({ path: process.env.HOME + '/Desktop/clim-asc-shots/age-answered.png' });
await b.close();
