// Measurements: safe formula engine + per-space measurement resolution.
// Formulas reference other measurements with {key}. Builtins derived from the
// openings list: {openings_total} (Σ w×h×qty) and {door_widths} (Σ door w×qty).
// Supported: numbers, + - * / ( ), unary minus, min(), max(), round(x[,d]), abs(), ceil(), floor().
import { db } from './db.js';
import { toNum, round, uid, nowISO } from '../core/utils.js';
import { MEASURE_DEFS } from '../data/models.js';
import { currentUserName } from './settings-service.js';

/* ---------------- Formula engine ---------------- */
function tokenize(src) {
  const toks = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9.]/.test(c)) {
      let j = i; while (j < src.length && /[0-9.]/.test(src[j])) j++;
      const n = parseFloat(src.slice(i, j));
      if (!Number.isFinite(n)) throw new Error(`Invalid number "${src.slice(i, j)}"`);
      toks.push({ t: 'num', v: n }); i = j; continue;
    }
    if (c === '{') {
      const j = src.indexOf('}', i);
      if (j < 0) throw new Error('Unclosed { in formula');
      const name = src.slice(i + 1, j).trim();
      if (!/^[a-z0-9_]+$/i.test(name)) throw new Error(`Invalid reference {${name}}`);
      toks.push({ t: 'var', v: name }); i = j + 1; continue;
    }
    if (/[a-z]/i.test(c)) {
      let j = i; while (j < src.length && /[a-z0-9_]/i.test(src[j])) j++;
      toks.push({ t: 'fn', v: src.slice(i, j).toLowerCase() }); i = j; continue;
    }
    if ('+-*/(),'.includes(c)) { toks.push({ t: c }); i++; continue; }
    throw new Error(`Unexpected character "${c}"`);
  }
  return toks;
}

const FNS = {
  min: (...a) => Math.min(...a), max: (...a) => Math.max(...a), abs: Math.abs,
  ceil: Math.ceil, floor: Math.floor, round: (x, d = 0) => round(x, d),
};

/** Parse into an AST once; evaluate with a resolver. */
export function parseFormula(src) {
  const toks = tokenize(String(src || ''));
  let p = 0;
  const peek = () => toks[p];
  const eat = (t) => { if (!toks[p] || toks[p].t !== t) throw new Error(`Expected "${t}"`); return toks[p++]; };
  function expr() {
    let n = term();
    while (peek() && (peek().t === '+' || peek().t === '-')) { const op = toks[p++].t; n = { op, a: n, b: term() }; }
    return n;
  }
  function term() {
    let n = factor();
    while (peek() && (peek().t === '*' || peek().t === '/')) { const op = toks[p++].t; n = { op, a: n, b: factor() }; }
    return n;
  }
  function factor() {
    const tk = peek();
    if (!tk) throw new Error('Unexpected end of formula');
    if (tk.t === '-') { p++; return { op: 'neg', a: factor() }; }
    if (tk.t === '+') { p++; return factor(); }
    if (tk.t === 'num') { p++; return { num: tk.v }; }
    if (tk.t === 'var') { p++; return { ref: tk.v }; }
    if (tk.t === 'fn') {
      p++;
      if (!FNS[tk.v]) throw new Error(`Unknown function ${tk.v}()`);
      eat('(');
      const args = [];
      if (peek() && peek().t !== ')') { args.push(expr()); while (peek() && peek().t === ',') { p++; args.push(expr()); } }
      eat(')');
      return { fn: tk.v, args };
    }
    if (tk.t === '(') { p++; const n = expr(); eat(')'); return n; }
    throw new Error(`Unexpected "${tk.t}"`);
  }
  if (!toks.length) throw new Error('Empty formula');
  const ast = expr();
  if (p < toks.length) throw new Error(`Unexpected "${toks[p].t}"`);
  return ast;
}

export function formulaRefs(src) {
  const out = new Set();
  String(src || '').replace(/\{([a-z0-9_]+)\}/gi, (_, k) => out.add(k));
  return [...out];
}

function evalAst(n, resolve) {
  if ('num' in n) return n.num;
  if ('ref' in n) { const v = resolve(n.ref); return v == null ? null : v; }
  if (n.fn) {
    const args = n.args.map((a) => evalAst(a, resolve));
    if (args.some((a) => a == null)) return null;
    return FNS[n.fn](...args);
  }
  if (n.op === 'neg') { const a = evalAst(n.a, resolve); return a == null ? null : -a; }
  const a = evalAst(n.a, resolve), b = evalAst(n.b, resolve);
  if (a == null || b == null) return null;
  switch (n.op) {
    case '+': return a + b;
    case '-': return a - b;
    case '*': return a * b;
    case '/': return b === 0 ? null : a / b;
  }
  return null;
}

export function validateFormula(src, knownKeys = []) {
  try {
    parseFormula(src);
    const unknown = formulaRefs(src).filter((r) => !knownKeys.includes(r) && !['openings_total', 'door_widths'].includes(r));
    if (unknown.length) return `Unknown reference: ${unknown.map((u) => `{${u}}`).join(', ')}`;
    return null;
  } catch (e) { return e.message; }
}

/* ---------------- Resolution ---------------- */
export function openingsTotals(measure) {
  const ops = (measure && measure.openings) || [];
  let area = 0, doors = 0;
  for (const o of ops) {
    const w = toNum(o.width) || 0, h = toNum(o.height) || 0, q = toNum(o.qty) || 0;
    area += w * h * q;
    if ((o.type || '').toLowerCase() === 'door') doors += w * q;
  }
  return { openings_total: round(area, 3), door_widths: round(doors, 3), hasOpenings: ops.length > 0 };
}

/**
 * Resolve every measurement of a space. Returns { [key]: { value, calculated, overridden, error, item } }.
 * value is the effective value (override > manual > formula).
 */
export function resolveMeasures(measure) {
  const items = (measure && measure.items) || [];
  const byKey = Object.fromEntries(items.map((it) => [it.key, it]));
  const builtins = openingsTotals(measure);
  const out = {};
  const visiting = new Set();
  const cyclic = new Set();

  function calc(key) {
    if (out[key]) return out[key].value;
    if (key === 'openings_total' || key === 'door_widths') return builtins.hasOpenings ? builtins[key] : (key === 'door_widths' ? 0 : null);
    const it = byKey[key];
    if (!it) return null;
    if (visiting.has(key)) { visiting.forEach((k) => cyclic.add(k)); return null; }
    visiting.add(key);
    let res;
    const overridden = it.override && toNum(it.override.value) != null;
    if (it.mode === 'formula' && it.formula) {
      let computed = null, error = null;
      try { computed = evalAst(parseFormula(it.formula), calc); } catch (e) { error = e.message; }
      computed = computed == null ? null : round(computed, 3);
      if (cyclic.has(key)) { computed = null; error = 'Circular reference'; }
      res = { value: overridden ? toNum(it.override.value) : computed, computed, calculated: true, overridden, error, item: it };
    } else {
      res = { value: overridden ? toNum(it.override.value) : toNum(it.value), calculated: false, overridden, item: it };
    }
    visiting.delete(key);
    out[key] = res;
    return res.value;
  }
  for (const it of items) calc(it.key);
  return out;
}

export function measureValue(space, key) {
  if (!space || !space.measure) return null;
  const r = resolveMeasures(space.measure)[key];
  return r ? r.value : null;
}

/* ---------------- Mutations ---------------- */
function mutate(spaceId, fn) {
  return db.update('spaces', spaceId, (s) => {
    s.measure = s.measure || { items: [], openings: [], drawingIds: [] };
    fn(s.measure, s);
    s.measure.updatedAt = nowISO();
  });
}

export const MeasurementService = {
  resolve: resolveMeasures,
  value: measureValue,
  setItem(spaceId, key, patch) {
    return mutate(spaceId, (m) => {
      const it = m.items.find((x) => x.key === key);
      if (it) Object.assign(it, patch);
    });
  },
  setValue(spaceId, key, raw) {
    return this.setItem(spaceId, key, { value: toNum(raw) });
  },
  setOverride(spaceId, key, value, reason) {
    return mutate(spaceId, (m) => {
      const it = m.items.find((x) => x.key === key);
      if (!it) return;
      it.override = value == null ? null : { value: toNum(value), reason: reason || '', by: currentUserName(), at: nowISO() };
    });
  },
  addCustom(spaceId, { label, unit, mode, formula, value, source, notes }) {
    const key = 'c_' + String(label || 'custom').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 24) + '_' + uid('').slice(-4);
    mutate(spaceId, (m) => {
      m.items.push({ key, label, unit: unit || 'm²', mode: mode || 'manual', formula: formula || '', value: toNum(value), source: source || '', notes: notes || '', override: null, core: false });
    });
    return key;
  },
  removeCustom(spaceId, key) {
    return mutate(spaceId, (m) => { m.items = m.items.filter((x) => x.key !== key || x.core); });
  },
  resetToDefault(spaceId, key) {
    const def = MEASURE_DEFS.find((d) => d.key === key);
    if (!def) return;
    return this.setItem(spaceId, key, { mode: def.mode, formula: def.formula || '' });
  },
  addOpening(spaceId, o) {
    return mutate(spaceId, (m) => { m.openings.push({ id: uid('op'), type: 'Door', label: '', width: null, height: null, qty: 1, ...o }); });
  },
  updateOpening(spaceId, id, patch) {
    return mutate(spaceId, (m) => { const o = m.openings.find((x) => x.id === id); if (o) Object.assign(o, patch); });
  },
  removeOpening(spaceId, id) {
    return mutate(spaceId, (m) => { m.openings = m.openings.filter((x) => x.id !== id); });
  },
  addDrawing(spaceId, fileId) { return mutate(spaceId, (m) => { m.drawingIds = [...(m.drawingIds || []), fileId]; }); },
  removeDrawing(spaceId, fileId) { return mutate(spaceId, (m) => { m.drawingIds = (m.drawingIds || []).filter((x) => x !== fileId); }); },
};
