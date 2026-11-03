const { chromium } = require('playwright');
(async () => {
  const dir = process.argv[2];
  const dsf = parseFloat(process.argv[3] || '1');
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1588, height: 1123 }, deviceScaleFactor: dsf });
  await p.goto('file://' + dir + '/package.html');
  await p.waitForLoadState('networkidle');
  await p.evaluate(() => document.fonts.ready);
  await p.pdf({ path: dir + '/out/package.pdf', width: '420mm', height: '297mm', printBackground: true, preferCSSPageSize: true });
  const s = await p.$$('section.sheet');
  for (let i = 0; i < s.length; i++) await s[i].screenshot({ path: `${dir}/out/sheet${i + 1}.png` });
  await b.close();
})();
