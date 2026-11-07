const { chromium } = require('playwright');
const SP = process.argv[2];
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 1300, height: 900 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route(/fonts\./, (r) => r.abort());
  await page.goto('http://localhost:8765/'); await page.waitForSelector('#shell', { timeout: 60000 });
  const res = await page.evaluate(async () => {
    const out = {};
    const M = await import('./services/measurement-service.js');
    const { db } = await import('./services/db.js');
    const { ProjectService } = await import('./services/project-service.js');
    const { TemplateService } = await import('./services/template-service.js');
    const { SearchService } = await import('./services/search-service.js');
    const { SpecService } = await import('./services/spec-service.js');
    // formula engine
    const ev = (f, vars) => M.resolveMeasures({ items: [{ key: 'a', mode: 'manual', value: vars.a }, { key: 'b', mode: 'manual', value: vars.b }, { key: 'x', mode: 'formula', formula: f }], openings: [] }).x;
    out.f1 = ev('({a} + {b}) * 2 - max({a}, 1)', { a: 3, b: 4 }).value;          // 11
    out.f2 = ev('round({a} / {b}, 2)', { a: 1, b: 3 }).value;                   // 0.33
    out.f3 = ev('{a} * {b}', { a: 3, b: null }).value;                          // null (incomplete)
    out.f4 = ev('{a} +', { a: 1 }).error;                                       // syntax error
    out.f5 = M.validateFormula('{nope} * 2', ['a']);                            // unknown ref
    const cyc = M.resolveMeasures({ items: [{ key: 'p', mode: 'formula', formula: '{q}' }, { key: 'q', mode: 'formula', formula: '{p}' }], openings: [] });
    out.f6 = cyc.p.error || cyc.q.error;                                        // circular
    out.f7 = M.validateFormula('alert(1)', []);                                 // no code exec
    // template update is non-destructive
    const sp = db.where('spaces', (s) => s.projectId === 'prj_demo_zed' && s.templateId === 'tpl_bedroom')[0];
    const before = JSON.stringify(sp.doc);
    TemplateService.update('tpl_bedroom', (t) => { t.sections.find((s) => s.key === 'general').fields.push({ key: 'new_fld', label: 'Acoustic rating', type: 'text' }); });
    const after = db.get('spaces', sp.id);
    out.t1 = JSON.stringify(after.doc) === before;                             // unchanged
    out.t2 = TemplateService.pendingAdditions(after)?.additions.map((a) => a.field.label);
    ProjectService.applyTemplateAdditions(sp.id);
    const applied = db.get('spaces', sp.id);
    out.t3 = applied.doc.sections.find((s) => s.key === 'general').fields.some((f) => f.key === 'new_fld') && applied.doc.sections.find((s) => s.key === 'general').values.function === sp.doc.sections.find((s) => s.key === 'general').values.function;
    // duplicate + move space
    const mbr = db.find('spaces', (s) => s.projectId === 'prj_demo_zed' && s.name === 'Master Bedroom');
    const copy = ProjectService.duplicateSpace(mbr.id);
    out.d1 = SpecService.applications({ spaceId: copy.id }).length === SpecService.applications({ spaceId: mbr.id }).length;
    const roof = ProjectService.floors('prj_demo_zed').find((f) => f.code === 'RF');
    ProjectService.moveSpace(copy.id, roof.id);
    out.d2 = db.get('spaces', copy.id).floorId === roof.id && /^RF|L1/.test(copy.code);
    // archive
    ProjectService.archive('prj_demo_wesal', true);
    out.a1 = ProjectService.all({ includeArchived: false }).every((p) => p.id !== 'prj_demo_wesal');
    ProjectService.archive('prj_demo_wesal', false);
    // search
    const r1 = SearchService.search('MAT-0001');
    out.s1 = r1.library[0].item.code + ' used in ' + r1.library[0].usedIn.length + ' spaces';
    const r2 = SearchService.search('master bedroom');
    out.s2 = r2.spaces.length + ' spaces, first has ' + r2.spaces[0].specs.length + ' specs';
    out.s3 = SearchService.search('lighting').categories.map((c) => c.item.label);
    return out;
  });
  console.log(JSON.stringify(res, null, 1));
  // mobile sheet preview fits
  const m = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })).newPage();
  await m.route(/fonts\./, (r) => r.abort());
  await m.goto('http://localhost:8765/'); await m.waitForSelector('#shell', { timeout: 60000 });
  const sid = await m.evaluate(() => JSON.parse(localStorage.getItem('yam:db:v1')).tables.spaces.find((s) => s.name === 'Living Room').id);
  await m.evaluate((h) => { location.hash = h; }, `/export/room/${sid}`); await m.waitForTimeout(800);
  console.log('mobile overflow px', await m.evaluate(() => document.documentElement.scrollWidth - innerWidth), 'fit', await m.evaluate(() => document.querySelector('#stage').style.getPropertyValue('--fit')));
  await m.screenshot({ path: SP + '/m-sheet2.png' });
  console.log('errors', errors);
  await b.close();
})();
