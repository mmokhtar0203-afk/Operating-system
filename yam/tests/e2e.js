// End-to-end acceptance workflow for YAM (drives the real UI).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const SP = process.argv[2];
const BASE = 'http://localhost:8765/';
const results = [];
const ok = (step, cond, detail = '') => { results.push({ step, pass: !!cond, detail }); console.log(`${cond ? 'PASS' : 'FAIL'}  ${step}${detail ? '  — ' + detail : ''}`); };

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED|fonts/.test(m.text())) errors.push(m.text()); });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());

  const go = async (h) => { await page.evaluate((x) => { location.hash = x; }, h); await page.waitForTimeout(350); };
  const modal = () => page.locator('.modal-backdrop').last();
  const act = async (a) => { await modal().locator(`.modal-foot [data-act="${a}"]`).click(); await page.waitForTimeout(250); };
  const db = () => page.evaluate(() => JSON.parse(localStorage.getItem('yam:db:v1')));
  const choose = async (clickSel, files, scope = page) => {
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), scope.locator(clickSel).first().click()]);
    await fc.setFiles(files);
    await page.waitForTimeout(500);
  };

  await page.goto(BASE);
  await page.waitForSelector('#shell', { timeout: 60000 });

  // 1. Create a residential project
  await go('/projects');
  await page.click('.page-head [data-action="new"]');
  await modal().locator('[name=name]').fill('Test Villa Heliopolis');
  await modal().locator('[name=client]').fill('Mrs. Test Client');
  await modal().locator('[name=floors]').fill('Ground Floor\nFirst Floor');
  await act('save');
  await page.waitForTimeout(400);
  let d = await db();
  const proj = d.tables.projects.find((p) => p.name === 'Test Villa Heliopolis');
  ok('1. Create residential project', proj && proj.code === 'TES', proj && `code ${proj.code}, ${d.tables.floors.filter((f) => f.projectId === proj.id).length} floors`);
  const pid = proj.id;

  // 2. Add multiple floors
  await go(`/projects/${pid}/spaces`);
  await page.click('.phead [data-action="add-floor"]');
  await modal().locator('[name=name]').fill('Roof');
  await modal().locator('[name=code]').fill('RF');
  await act('ok');
  d = await db();
  const floors = d.tables.floors.filter((f) => f.projectId === pid);
  ok('2. Add multiple floors', floors.length === 3, floors.map((f) => `${f.code} ${f.name}`).join(', '));

  // 3. Add master bedroom & bathroom
  const first = floors.find((f) => f.name === 'First Floor');
  await page.click('.phead [data-action="add-space"]');
  await modal().locator('[name=templateId]').selectOption('tpl_master');
  await modal().locator('[name=floorId]').selectOption(first.id);
  await act('ok');
  await page.waitForTimeout(400);
  await page.click('.ws-nav [data-action="add-space"]');
  await modal().locator('[name=templateId]').selectOption('tpl_bathroom');
  await modal().locator('[name=name]').fill('Master Bathroom');
  await modal().locator('[name=floorId]').selectOption(first.id);
  await act('ok');
  d = await db();
  const mb = d.tables.spaces.find((s) => s.projectId === pid && s.name === 'Master Bedroom');
  const bath = d.tables.spaces.find((s) => s.projectId === pid && s.name === 'Master Bathroom');
  ok('3. Add master bedroom & bathroom', mb && bath, mb && `${mb.code} ${mb.name} (${mb.typeName}), ${bath.code} ${bath.name}`);

  // 4. Enter measurements
  const measure = async (sid, fa, per, h) => {
    await go(`/projects/${pid}/spaces/${sid}`);
    for (const [k, v] of [['floor_area', fa], ['perimeter', per], ['ceiling_height', h]]) {
      await page.fill(`[data-mval="${k}"]`, String(v));
      await page.press(`[data-mval="${k}"]`, 'Tab');
      await page.waitForTimeout(120);
    }
    await page.click('[data-action="add-op"]');
    await page.waitForTimeout(250);
  };
  await measure(mb.id, 24.5, 20, 3);
  await measure(bath.id, 7.2, 10.8, 2.8);
  d = await db();
  const mbm = d.tables.spaces.find((s) => s.id === mb.id).measure;
  const net = await page.evaluate(async (sid) => {
    const { db } = await import('./services/db.js');
    const { resolveMeasures } = await import('./services/measurement-service.js');
    const r = resolveMeasures(db.get('spaces', sid).measure);
    return { net: r.net_wall_area.value, gross: r.gross_wall_area.value, skirting: r.skirting_length.value, ceil: r.ceiling_area.value };
  }, mb.id);
  ok('4. Enter measurements (derived values)', mbm.items.find((x) => x.key === 'floor_area').value === 24.5 && net.gross === 60 && Math.abs(net.net - 58.02) < 0.001 && Math.abs(net.skirting - 19.1) < 0.001,
    `gross ${net.gross} m², net ${net.net} m², skirting ${net.skirting} lm, ceiling ${net.ceil} m²`);
  // override with reason
  await go(`/projects/${pid}/spaces/${mb.id}`);
  await page.click('[data-action="m-menu"][data-key="ceiling_area"]');
  await page.click('.menu button:has-text("Override value")');
  await modal().locator('[name=value]').fill('23.9');
  await modal().locator('[name=reason]').fill('Bulkhead reduces ceiling area');
  await act('ok');
  d = await db();
  const ov = d.tables.spaces.find((s) => s.id === mb.id).measure.items.find((x) => x.key === 'ceiling_area').override;
  ok('4b. Override calculated value with reason', ov && ov.value === 23.9 && ov.reason, ov && `${ov.value} — "${ov.reason}" by ${ov.by}`);

  // 5. Add materials to the global library
  await go('/library');
  await page.click('.page-head [data-action="new"]');
  await modal().locator('[name=name]').fill('Test Oak Flooring 220');
  await modal().locator('[name=_category]').selectOption('flooring');
  await modal().locator('[name=manufacturer]').fill('Test Floors Ltd');
  await modal().locator('[name=reference]').fill('TF-OAK-220');
  await modal().locator('[name=colour]').fill('Honey oak');
  await modal().locator('[name=finish]').fill('Matt lacquer');
  await modal().locator('[name=unitPrice]').fill('2100');
  await choose('[data-addimg]', [path.join(SP, 'ref.png')], modal());
  await choose('[data-adddoc]', [path.join(SP, 'datasheet.pdf')], modal());
  await act('save');
  await page.waitForTimeout(600);
  d = await db();
  const lib = d.tables.library.find((l) => l.data.name === 'Test Oak Flooring 220');
  ok('5. Add material to global library', lib && /^MAT-\d{4}$/.test(lib.code) && lib.data.imageIds.length === 1 && lib.data.datasheetIds.length === 1, lib && `${lib.code}, 1 image, 1 datasheet`);

  // 6 & 7. Assign materials to rooms with quantities
  const addFromLibrary = async (sid, disc, query, qty = null) => {
    await go(`/projects/${pid}/spaces/${sid}`);
    await page.click(`.wsec-head [data-action="add-item"][data-disc="${disc}"]`);
    await modal().locator('[data-t="library"]').click();
    await modal().locator('[data-q]').fill(query);
    await page.waitForTimeout(200);
    await modal().locator('[data-pick-lib]').first().click();
    await page.waitForTimeout(300);
    if (qty != null) { await modal().locator('[data-m="manual"]').click(); await modal().locator('[name=quantity]').fill(String(qty)); }
    await act('save');
  };
  await addFromLibrary(mb.id, 'flooring', 'Test Oak');               // linked to floor area +5%
  await addFromLibrary(mb.id, 'walls', 'Comfort Grey');              // linked to net wall area (default)
  await addFromLibrary(bath.id, 'flooring', 'Calacatta', 7.9);       // manual
  // assign the oak to the bathroom? no — assign the existing project spec to the bathroom ceiling via project tab
  await go(`/projects/${pid}/spaces/${bath.id}`);
  await page.click('.wsec-head [data-action="add-item"][data-disc="ceiling"]');
  await modal().locator('[data-t="custom"]').click();
  await modal().locator('[name=name]').fill('MR Gypsum Ceiling (custom)');
  await modal().locator('[name=unitPrice]').fill('650');
  await act('save');
  await page.waitForTimeout(300);
  await act('save'); // quantity step (linked to ceiling area default)
  d = await db();
  const specs = d.tables.specs.filter((s) => s.projectId === pid);
  const apps = d.tables.applications.filter((a) => a.projectId === pid);
  const oakSpec = specs.find((s) => s.libraryId === lib.id);
  const oakApp = apps.find((a) => a.specId === oakSpec.id);
  const oakQty = await page.evaluate(async (id) => { const { db } = await import('./services/db.js'); const { SpecService } = await import('./services/spec-service.js'); return SpecService.effectiveQty(db.get('applications', id)); }, oakApp.id);
  ok('6. Assign library materials to rooms (project codes)', oakSpec && oakSpec.code === 'TES-FL-01' && oakSpec.libraryCode === lib.code, `${specs.map((s) => s.code).join(', ')}`);
  ok('7. Quantities (linked + manual, units kept)', oakApp.qtyMode === 'measure' && oakQty === 25.73 && apps.some((a) => a.quantity === 7.9), `oak ${oakQty} m² (24.5 m² +5%), marble manual 7.9 m²`);

  // 8. Electrical & lighting
  await addFromLibrary(mb.id, 'electrical', 'Double Switched', 4);
  await go(`/projects/${pid}/spaces/${mb.id}`);
  await page.click('.wsec-head [data-action="add-item"][data-disc="lighting"]');
  await modal().locator('[data-t="custom"]').click();
  await modal().locator('[name=name]').fill('Test Recessed Spot 7W');
  await modal().locator('[name="attr.wattage"]').fill('7');
  await modal().locator('[name="attr.cct"]').fill('3000');
  await modal().locator('[name="attr.beam"]').fill('24');
  await modal().locator('[name="attr.ip"]').fill('IP44');
  await modal().locator('[name="attr.dimming"]').selectOption('DALI');
  await act('save');
  await page.waitForTimeout(300);
  await modal().locator('[name=quantity]').fill('6');
  await act('save');
  d = await db();
  const lt = d.tables.specs.find((s) => s.projectId === pid && s.discipline === 'lighting');
  const el = d.tables.specs.find((s) => s.projectId === pid && s.discipline === 'electrical');
  ok('8. Electrical & lighting items', lt && lt.code === 'TES-LT-01' && lt.data.attrs.wattage === 7 && lt.data.attrs.cct === 3000 && el && el.code === 'TES-EL-01', `${el && el.code} ×4, ${lt && lt.code} 7W/3000K/24°/IP44/DALI ×6`);

  // 9. Furniture & joinery
  const custom = async (disc, name, fill, qty) => {
    await go(`/projects/${pid}/spaces/${mb.id}`);
    await page.click(`.wsec-head [data-action="add-item"][data-disc="${disc}"]`);
    await modal().locator('[data-t="custom"]').click();
    await modal().locator('[name=name]').fill(name);
    for (const [k, v] of Object.entries(fill)) await modal().locator(`[name="${k}"]`).fill(v);
    await choose('[data-addimg]', [path.join(SP, 'ref.png')], modal());
    await act('save');
    await page.waitForTimeout(300);
    await modal().locator('[name=quantity]').fill(String(qty));
    await act('save');
  };
  await custom('furniture', 'Test King Bed', { dimensions: '2000 × 2200', 'attr.material': 'Walnut, linen', 'attr.fabricator': 'Atelier X' }, 1);
  await custom('joinery', 'Test Wardrobe Wall', { dimensions: '3600 × 600 × 2900', 'attr.hardware': 'Blum TIP-ON', 'attr.edges': '1 mm oak lipping', 'attr.internal': 'Long hang + 8 drawers', 'attr.elevations': 'E1-E3' }, 1);
  d = await db();
  const fn = d.tables.specs.find((s) => s.projectId === pid && s.discipline === 'furniture');
  const jn = d.tables.specs.find((s) => s.projectId === pid && s.discipline === 'joinery');
  ok('9. Furniture & joinery', fn && jn && jn.data.attrs.hardware === 'Blum TIP-ON' && jn.data.name === 'Test Wardrobe Wall' && jn.data.dimensions === '3600 × 600 × 2900' && fn.data.imageIds.length === 1, `name='${jn && jn.data.name}' dims='${jn && jn.data.dimensions}' ${fn && fn.code}, ${jn && jn.code} (hardware/edges/internal/elevations stored)`);

  // 10. Consolidated schedules
  await go(`/projects/${pid}/schedules/floor`);
  const floorRows = await page.locator('.tbl tbody tr').count();
  const floorText = await page.locator('.tbl').innerText();
  await go(`/projects/${pid}/schedules/lighting`);
  const ltText = await page.locator('.tbl').innerText();
  await go(`/projects/${pid}/schedules/general`);
  await page.click('[data-m="consolidated"]');
  await page.waitForTimeout(300);
  const genRows = await page.locator('.tbl tbody tr').count();
  ok('10. Consolidated project schedules', floorRows === 2 && /Test Oak Flooring/.test(floorText) && /25\.73/.test(floorText) && /Test Recessed Spot/.test(ltText) && /3,000|3000/.test(ltText) && genRows >= 7, `floor rows ${floorRows}, general consolidated rows ${genRows}`);
  // CSV export download
  await page.click('[data-action="export"]');
  const [csvDl] = await Promise.all([page.waitForEvent('download'), page.click('.menu button:has-text("CSV")')]);
  const csvPath = path.join(SP, 'schedule.csv'); await csvDl.saveAs(csvPath);
  const csv = fs.readFileSync(csvPath, 'utf8');
  await page.click('[data-action="export"]');
  const [xlsDl] = await Promise.all([page.waitForEvent('download'), page.click('.menu button:has-text("Excel (.xls)")')]);
  const xlsPath = path.join(SP, 'schedule.xls'); await xlsDl.saveAs(xlsPath);
  ok('10b. Schedule export CSV + Excel', /Test Oak Flooring/.test(csv) && fs.readFileSync(xlsPath, 'utf8').includes('<Workbook'), `${csv.split('\n').length - 1} CSV rows`);

  // 11. Change an approved material and preserve its previous revision
  await go(`/projects/${pid}/specs/${oakSpec.id}`);
  await page.click('[data-action="status"][data-s="approved"]');
  await modal().locator('[name=note]').fill('Approved by client — sample signed');
  await choose('[data-pick]', [path.join(SP, 'ref.png')], modal());
  await act('ok');
  await page.waitForTimeout(400);
  await page.click('.page-head [data-action="edit"]');
  await modal().locator('[name=colour]').fill('Smoked honey oak');
  await act('save');            // should be refused: reason required
  const stillOpen = await page.locator('.modal-backdrop').count();
  await modal().locator('[name=_reason]').fill('Client changed tone after site mock-up');
  await act('save');
  await page.waitForTimeout(400);
  d = await db();
  const rev = d.tables.specs.find((s) => s.id === oakSpec.id);
  const r0 = rev.revisions[0];
  ok('11. Revision on change of approved spec', stillOpen === 1 && rev.rev === 1 && rev.status === 'draft' && r0 && r0.status === 'approved' && r0.data.colour === 'Honey oak' && r0.approvals.some((a) => a.fileIds.length) && r0.closedBy && r0.reason,
    `now R01 ${rev.status}; R00 kept: ${r0 && r0.status}, colour "${r0 && r0.data.colour}", evidence preserved, by ${r0 && r0.closedBy}`);
  // library change must NOT silently modify project spec
  await go(`/library/${lib.id}`);
  await page.click('.page-head [data-action="edit"]');
  await modal().locator('[name=reference]').fill('TF-OAK-220-V2');
  await act('save');
  await page.waitForTimeout(300);
  d = await db();
  const after = d.tables.specs.find((s) => s.id === oakSpec.id);
  await go(`/projects/${pid}/specs/${oakSpec.id}`);
  const flagged = await page.locator('[data-action="review-lib"]').count();
  ok('11b. Library edit does not silently change project spec', after.data.reference === 'TF-OAK-220' && flagged === 1, 'spec kept TF-OAK-220; review notice shown');

  // 12. Attach reference images and drawings
  await go(`/projects/${pid}/spaces/${mb.id}`);
  await choose('[data-action="upload-docs"]', [path.join(SP, 'ref.png'), path.join(SP, 'datasheet.pdf')]);
  await choose('[data-action="add-drawing"]', [path.join(SP, 'drawing.png')]);
  d = await db();
  const mbNow = d.tables.spaces.find((s) => s.id === mb.id);
  const blobOk = await page.evaluate(async (id) => { const { BlobStore } = await import('./storage/blob-store.js'); const b = await BlobStore.get(id); return b ? b.size : 0; }, mbNow.measure.drawingIds[0]);
  ok('12. Attach reference images & drawings', mbNow.fileIds.length === 2 && mbNow.measure.drawingIds.length === 1 && blobOk > 0, `${mbNow.fileIds.length} room files, 1 measurement drawing (blob ${blobOk} B in IndexedDB)`);

  // 13. Technical room sheet (PDF via print CSS)
  await go(`/export/room/${mb.id}`);
  await page.waitForTimeout(700);
  const sheets = await page.locator('.sheet').count();
  await page.emulateMedia({ media: 'print' });
  const pdf1 = path.join(SP, 'room-sheet.pdf');
  await page.pdf({ path: pdf1, preferCSSPageSize: true, printBackground: true });
  await page.emulateMedia({ media: 'screen' });
  const [htmlDl] = await Promise.all([page.waitForEvent('download'), page.click('[data-action="html"]')]);
  const htmlPath = path.join(SP, 'room-sheet.html'); await htmlDl.saveAs(htmlPath);
  const html = fs.readFileSync(htmlPath, 'utf8');
  ok('13. Export technical room sheet', sheets >= 2 && fs.statSync(pdf1).size > 20000 && html.includes('data:image'), `${sheets} A4 sheets, PDF ${(fs.statSync(pdf1).size / 1024).toFixed(0)} KB, standalone HTML with embedded images`);

  // 14. Visual material board
  await go(`/export/board/${pid}`);
  await page.waitForTimeout(700);
  const boards = await page.locator('.sheet.board').count();
  await page.emulateMedia({ media: 'print' });
  const pdf2 = path.join(SP, 'material-board.pdf');
  await page.pdf({ path: pdf2, preferCSSPageSize: true, printBackground: true });
  await page.emulateMedia({ media: 'screen' });
  ok('14. Export visual material board', boards >= 2 && fs.statSync(pdf2).size > 20000, `${boards} landscape sheets, PDF ${(fs.statSync(pdf2).size / 1024).toFixed(0)} KB`);

  // 15. Refresh without losing data
  const before = await db();
  await page.reload();
  await page.waitForSelector('#shell');
  await go(`/projects/${pid}/spaces/${mb.id}`);
  await page.waitForTimeout(600);
  const afterReload = await db();
  const imgsLoaded = await page.evaluate(() => Array.from(document.querySelectorAll('#view img[data-file]')).filter((i) => i.src.startsWith('blob:')).length);
  const fa = await page.inputValue('[data-mval="floor_area"]');
  ok('15. Refresh keeps data', JSON.stringify(before.tables) === JSON.stringify(afterReload.tables) && fa === '24.5' && imgsLoaded > 0, `${afterReload.tables.specs.filter((s) => s.projectId === pid).length} specs, floor area ${fa}, ${imgsLoaded} images re-hydrated from IndexedDB`);

  // 16. Export and restore a project backup
  await go(`/projects/${pid}`);
  await page.click('.phead [data-action="more"]');
  const [bk] = await Promise.all([page.waitForEvent('download'), page.click('.menu button:has-text("Export project backup")')]);
  const bkPath = path.join(SP, 'project-backup.json'); await bk.saveAs(bkPath);
  const counts = (dd) => ({ spaces: dd.tables.spaces.filter((s) => s.projectId === pid).length, specs: dd.tables.specs.filter((s) => s.projectId === pid).length, apps: dd.tables.applications.filter((s) => s.projectId === pid).length });
  const c0 = counts(await db());
  await page.click('.phead [data-action="more"]');
  await page.click('.menu button:has-text("Delete project")');
  await act('ok');
  await page.waitForTimeout(500);
  const gone = !(await db()).tables.projects.find((p) => p.id === pid);
  await go('/projects');
  await choose('.page-head [data-action="restore"]', [bkPath]);
  await act('copy');
  await page.waitForTimeout(1200);
  const c1 = counts(await db());
  const restoredRev = (await db()).tables.specs.find((s) => s.id === oakSpec.id);
  const evidenceBlob = await page.evaluate(async (id) => { const { BlobStore } = await import('./storage/blob-store.js'); return !!(await BlobStore.get(id)); }, restoredRev.revisions[0].approvals.find((a) => a.fileIds.length).fileIds[0]);
  ok('16. Export & restore project backup', gone && JSON.stringify(c0) === JSON.stringify(c1) && restoredRev.revisions.length === 1 && evidenceBlob, `deleted then restored: ${JSON.stringify(c1)}, revisions & approval evidence intact`);
  // full backup round-trip
  await go('/settings');
  const [full] = await Promise.all([page.waitForEvent('download'), page.click('[data-action="export-all"]')]);
  const fullPath = path.join(SP, 'full-backup.json'); await full.saveAs(fullPath);
  const fullObj = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  ok('16b. Full JSON backup export', fullObj.app === 'YAM' && fullObj.files.length > 50, `${fullObj.db.tables.projects.length} projects, ${fullObj.files.length} files, ${(fs.statSync(fullPath).size / 1024 / 1024).toFixed(1)} MB`);

  // 17. Mobile
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const m = await mctx.newPage();
  await m.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  m.on('pageerror', (e) => errors.push('mobile: ' + e.message));
  await m.goto(BASE);
  await m.waitForSelector('#shell', { timeout: 60000 });
  const overflow = [];
  const mSid = await m.evaluate(() => JSON.parse(localStorage.getItem('yam:db:v1')).tables.spaces.find((s) => s.projectId === 'prj_demo_zed' && s.name === 'Master Bedroom').id);
  const shots = [['/', 'm-dashboard'], ['/projects/prj_demo_zed/spaces', 'm-spaces'], [`/projects/prj_demo_zed/spaces/${mSid}`, 'm-space'], [`/export/room/${mSid}`, 'm-sheet'], ['/library', 'm-library'], ['/search?q=ZED-FL-01', 'm-search'], ['/projects/prj_demo_zed/schedules/lighting', 'm-schedule']];
  for (const [h, n] of shots) {
    await m.evaluate((x) => { location.hash = x; }, h);
    await m.waitForTimeout(600);
    const o = await m.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (o > 1) overflow.push(`${h}: +${o}px`);
    await m.screenshot({ path: path.join(SP, n + '.png') });
  }
  const tabbar = await m.locator('#tabbar').isVisible();
  ok('17. Mobile layout', tabbar && !overflow.length, overflow.length ? 'horizontal overflow: ' + overflow.join(', ') : 'bottom tab bar, no horizontal overflow on 6 screens');

  ok('No runtime errors', errors.length === 0, errors.slice(0, 5).join(' | '));
  const passed = results.filter((r) => r.pass).length;
  console.log(`\n${passed}/${results.length} checks passed`);
  fs.writeFileSync(path.join(SP, 'e2e-results.json'), JSON.stringify(results, null, 2));
  await browser.close();
})().catch((e) => { console.error('E2E CRASH', e); process.exit(1); });
