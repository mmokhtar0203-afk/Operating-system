// Procedural material swatches and product line drawings for the demo library.
// Generated on a canvas at seed time so the prototype works fully offline.

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
function hexToRgb(h) {
  const n = parseInt(h.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function shade(hex, amt) {
  const [r, g, b] = hexToRgb(hex);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c + amt)));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}
function mk(w = 640, h = 640) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
function grain(ctx, w, h, amount, rand) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rand() - 0.5) * amount;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

const PAINTERS = {
  wood(ctx, w, h, o, rand) {
    const plankH = o.plank || 92;
    for (let y = 0; y < h; y += plankH) {
      const tone = (rand() - 0.5) * 26;
      ctx.fillStyle = shade(o.color, tone);
      ctx.fillRect(0, y, w, plankH);
      for (let i = 0; i < 26; i++) {
        ctx.strokeStyle = shade(o.color, tone - 18 - rand() * 22);
        ctx.globalAlpha = 0.18 + rand() * 0.25;
        ctx.lineWidth = 0.6 + rand() * 1.6;
        ctx.beginPath();
        const yy = y + rand() * plankH;
        const amp = 2 + rand() * 6, freq = 0.004 + rand() * 0.01, ph = rand() * 6;
        for (let x = 0; x <= w; x += 8) ctx.lineTo(x, yy + Math.sin(x * freq + ph) * amp);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      if (!o.veneer) {
        ctx.fillStyle = 'rgba(40,25,10,.35)';
        ctx.fillRect(0, y, w, 1.5);
        const jx = rand() * w;
        ctx.fillRect(jx, y, 1.5, plankH);
      }
    }
  },
  herringbone(ctx, w, h, o, rand) {
    const L = 150, W = 38;
    ctx.fillStyle = o.color; ctx.fillRect(0, 0, w, h);
    for (let row = -2; row < h / W + 4; row++) {
      for (let col = -2; col < w / (W * 2) + 3; col++) {
        for (const dir of [1, -1]) {
          ctx.save();
          const x = col * W * 2 * 1.414 + (dir > 0 ? 0 : W * 1.414), y = row * W * 1.414 * 2;
          ctx.translate(x, y);
          ctx.rotate(dir * Math.PI / 4);
          ctx.fillStyle = shade(o.color, (rand() - 0.5) * 34);
          ctx.fillRect(0, 0, L, W);
          ctx.strokeStyle = 'rgba(40,25,10,.4)'; ctx.lineWidth = 1;
          ctx.strokeRect(0, 0, L, W);
          ctx.restore();
        }
      }
    }
  },
  marble(ctx, w, h, o, rand) {
    ctx.fillStyle = o.color; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < (o.veins || 9); i++) {
      ctx.strokeStyle = o.vein;
      ctx.globalAlpha = 0.15 + rand() * 0.45;
      ctx.lineWidth = 0.6 + rand() * (o.thick || 3);
      ctx.beginPath();
      let x = rand() * w, y = -20;
      ctx.moveTo(x, y);
      while (y < h + 20) { x += (rand() - 0.45) * 60; y += 20 + rand() * 40; ctx.lineTo(x, y); }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  },
  stone(ctx, w, h, o, rand) {
    ctx.fillStyle = o.color; ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 3 + rand() * 9) {
      ctx.fillStyle = shade(o.color, (rand() - 0.5) * 22);
      ctx.globalAlpha = 0.5;
      ctx.fillRect(0, y, w, 2 + rand() * 6);
    }
    ctx.globalAlpha = 1;
    for (let i = 0; i < 160; i++) {
      ctx.fillStyle = shade(o.color, -30 - rand() * 30);
      ctx.globalAlpha = 0.25;
      ctx.beginPath(); ctx.ellipse(rand() * w, rand() * h, 1 + rand() * 6, 0.5 + rand() * 1.6, 0, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (o.joints) { ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2; for (let y = 0; y <= h; y += h / 2) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); } ctx.beginPath(); ctx.moveTo(w * 0.6, 0); ctx.lineTo(w * 0.6, h / 2); ctx.moveTo(w * 0.25, h / 2); ctx.lineTo(w * 0.25, h); ctx.stroke(); }
  },
  paint(ctx, w, h, o) {
    ctx.fillStyle = o.color; ctx.fillRect(0, 0, w, h);
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, 'rgba(255,255,255,.10)'); g.addColorStop(1, 'rgba(0,0,0,.06)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  },
  plaster(ctx, w, h, o, rand) {
    ctx.fillStyle = o.color; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      ctx.fillStyle = shade(o.color, (rand() - 0.5) * 30);
      ctx.globalAlpha = 0.18;
      ctx.beginPath(); ctx.ellipse(rand() * w, rand() * h, 20 + rand() * 70, 6 + rand() * 20, rand() * 3, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
  },
  tile(ctx, w, h, o, rand) {
    const cols = o.cols || 2, rows = o.rows || 4, gw = o.grout || 3;
    ctx.fillStyle = o.groutColor || '#d9d4cb'; ctx.fillRect(0, 0, w, h);
    const tw = w / cols, th = h / rows;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      ctx.fillStyle = shade(o.color, (rand() - 0.5) * (o.vary || 10));
      ctx.fillRect(c * tw + gw / 2, r * th + gw / 2, tw - gw, th - gw);
      if (o.gloss) {
        const g = ctx.createLinearGradient(c * tw, r * th, c * tw + tw, r * th + th);
        g.addColorStop(0, 'rgba(255,255,255,.35)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,.08)');
        ctx.fillStyle = g; ctx.fillRect(c * tw + gw / 2, r * th + gw / 2, tw - gw, th - gw);
      }
    }
  },
  fluted(ctx, w, h, o) {
    const n = 18, fw = w / n;
    for (let i = 0; i < n; i++) {
      const g = ctx.createLinearGradient(i * fw, 0, (i + 1) * fw, 0);
      g.addColorStop(0, shade(o.color, -26)); g.addColorStop(0.5, shade(o.color, 14)); g.addColorStop(1, shade(o.color, -20));
      ctx.fillStyle = g; ctx.fillRect(i * fw, 0, fw, h);
    }
  },
  solid(ctx, w, h, o) {
    ctx.fillStyle = o.color; ctx.fillRect(0, 0, w, h);
  },
  metal(ctx, w, h, o, rand) {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, shade(o.color, 30)); g.addColorStop(0.5, o.color); g.addColorStop(1, shade(o.color, -30));
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) { ctx.fillStyle = `rgba(255,255,255,${rand() * 0.06})`; ctx.fillRect(0, y, w, 1); }
  },
};

/* ---------- Product line drawings ---------- */
const INK = '#2A2723';
const DRAW = {
  downlight(c, w, h) { c.beginPath(); c.arc(w / 2, h / 2, 140, 0, 7); c.stroke(); c.beginPath(); c.arc(w / 2, h / 2, 100, 0, 7); c.stroke(); c.fillStyle = '#F8F1DC'; c.beginPath(); c.arc(w / 2, h / 2, 60, 0, 7); c.fill(); c.stroke(); },
  pendant(c, w, h) { c.beginPath(); c.moveTo(w / 2, 40); c.lineTo(w / 2, 260); c.stroke(); c.fillStyle = '#F4EEE2'; c.beginPath(); c.arc(w / 2, 380, 130, 0, 7); c.fill(); c.stroke(); c.beginPath(); c.moveTo(w / 2 - 22, 252); c.lineTo(w / 2 + 22, 252); c.stroke(); },
  linear(c, w, h) { c.strokeRect(70, h / 2 - 22, w - 140, 44); c.fillStyle = '#F8F1DC'; c.fillRect(80, h / 2 - 8, w - 160, 16); c.setLineDash([6, 10]); c.beginPath(); c.moveTo(80, h / 2 + 60); c.lineTo(w - 80, h / 2 + 60); c.stroke(); c.setLineDash([]); },
  washer(c, w, h) { c.strokeRect(w / 2 - 50, 120, 100, 400); for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(w / 2, 170 + i * 75, 20, 0, 7); c.stroke(); } },
  wall_light(c, w, h) { c.strokeRect(w / 2 - 70, 160, 140, 320); c.beginPath(); c.moveTo(w / 2 - 70, 220); c.lineTo(w / 2 + 70, 220); c.moveTo(w / 2 - 70, 420); c.lineTo(w / 2 + 70, 420); c.stroke(); },
  socket2(c, w, h) { rr(c, 110, 190, 420, 260, 18); c.stroke(); for (const x of [215, 425]) { rr(c, x - 70, 230, 140, 180, 12); c.stroke(); c.fillStyle = INK; c.fillRect(x - 6, 260, 12, 34); c.fillRect(x - 40, 330, 28, 12); c.fillRect(x + 12, 330, 28, 12); } },
  socket1(c, w, h) { rr(c, 190, 190, 260, 260, 18); c.stroke(); c.fillStyle = INK; c.fillRect(314, 245, 12, 40); c.fillRect(270, 330, 30, 13); c.fillRect(340, 330, 30, 13); },
  switch(c, w, h) { rr(c, 190, 190, 260, 260, 18); c.stroke(); rr(c, 230, 230, 180, 180, 10); c.stroke(); c.beginPath(); c.moveTo(320, 300); c.lineTo(320, 340); c.stroke(); },
  dimmer(c, w, h) { rr(c, 190, 190, 260, 260, 18); c.stroke(); c.beginPath(); c.arc(320, 320, 70, 0, 7); c.stroke(); c.beginPath(); c.moveTo(320, 260); c.lineTo(320, 290); c.stroke(); },
  data(c, w, h) { rr(c, 190, 190, 260, 260, 18); c.stroke(); c.strokeRect(275, 280, 90, 70); c.strokeRect(300, 350, 40, 14); },
  usb(c, w, h) { rr(c, 190, 190, 260, 260, 18); c.stroke(); rr(c, 255, 290, 50, 22, 10); c.stroke(); rr(c, 335, 290, 50, 22, 10); c.stroke(); },
  wc(c, w, h) { c.strokeRect(220, 130, 200, 120); c.beginPath(); c.ellipse(320, 380, 120, 150, 0, 0, 7); c.stroke(); c.beginPath(); c.ellipse(320, 390, 80, 110, 0, 0, 7); c.stroke(); },
  basin(c, w, h) { c.beginPath(); c.ellipse(320, 340, 210, 110, 0, 0, 7); c.stroke(); c.beginPath(); c.ellipse(320, 340, 170, 80, 0, 0, 7); c.stroke(); c.beginPath(); c.arc(320, 350, 12, 0, 7); c.stroke(); },
  mixer(c, w, h) { c.strokeRect(290, 260, 60, 260); c.beginPath(); c.moveTo(320, 270); c.lineTo(320, 200); c.lineTo(450, 200); c.lineTo(450, 230); c.stroke(); c.beginPath(); c.moveTo(350, 300); c.lineTo(420, 280); c.stroke(); },
  shower(c, w, h) { c.beginPath(); c.moveTo(200, 560); c.lineTo(200, 140); c.lineTo(380, 140); c.stroke(); c.beginPath(); c.ellipse(420, 160, 90, 22, 0, 0, 7); c.stroke(); c.beginPath(); c.arc(200, 420, 34, 0, 7); c.stroke(); },
  bathtub(c, w, h) { c.beginPath(); c.moveTo(80, 260); c.lineTo(560, 260); c.bezierCurveTo(560, 470, 480, 480, 320, 480); c.bezierCurveTo(160, 480, 80, 470, 80, 260); c.stroke(); },
  cistern(c, w, h) { c.strokeRect(200, 120, 240, 400); rr(c, 260, 220, 120, 80, 8); c.stroke(); c.beginPath(); c.moveTo(320, 220); c.lineTo(320, 300); c.stroke(); },
  sofa(c, w, h) { rr(c, 80, 260, 480, 170, 20); c.stroke(); rr(c, 60, 300, 60, 160, 16); c.stroke(); rr(c, 520, 300, 60, 160, 16); c.stroke(); c.beginPath(); c.moveTo(240, 340); c.lineTo(240, 430); c.moveTo(400, 340); c.lineTo(400, 430); c.stroke(); c.beginPath(); c.moveTo(110, 460); c.lineTo(110, 490); c.moveTo(530, 460); c.lineTo(530, 490); c.stroke(); },
  chair(c, w, h) { c.beginPath(); c.moveTo(220, 150); c.lineTo(240, 340); c.lineTo(420, 340); c.lineTo(440, 150); c.stroke(); c.beginPath(); c.moveTo(220, 340); c.lineTo(440, 340); c.moveTo(240, 340); c.lineTo(230, 520); c.moveTo(420, 340); c.lineTo(430, 520); c.stroke(); },
  table(c, w, h) { c.beginPath(); c.ellipse(320, 250, 230, 60, 0, 0, 7); c.stroke(); c.beginPath(); c.moveTo(320, 310); c.lineTo(320, 500); c.moveTo(240, 520); c.lineTo(400, 520); c.stroke(); },
  bed(c, w, h) { c.strokeRect(100, 150, 440, 120); c.strokeRect(120, 270, 400, 230); c.beginPath(); c.moveTo(120, 330); c.lineTo(520, 330); c.stroke(); rr(c, 150, 285, 150, 35, 10); c.stroke(); rr(c, 340, 285, 150, 35, 10); c.stroke(); },
  bedside(c, w, h) { c.strokeRect(200, 220, 240, 250); c.beginPath(); c.moveTo(200, 330); c.lineTo(440, 330); c.stroke(); c.beginPath(); c.moveTo(290, 275); c.lineTo(350, 275); c.moveTo(290, 395); c.lineTo(350, 395); c.stroke(); },
  wardrobe(c, w, h) { c.strokeRect(120, 90, 400, 470); for (const x of [253, 386]) { c.beginPath(); c.moveTo(x, 90); c.lineTo(x, 560); c.stroke(); } c.beginPath(); c.moveTo(240, 300); c.lineTo(240, 360); c.moveTo(266, 300); c.lineTo(266, 360); c.stroke(); },
  kitchen(c, w, h) { c.strokeRect(70, 300, 500, 220); c.strokeRect(70, 100, 500, 140); for (const x of [195, 320, 445]) { c.beginPath(); c.moveTo(x, 300); c.lineTo(x, 520); c.moveTo(x, 100); c.lineTo(x, 240); c.stroke(); } c.beginPath(); c.moveTo(60, 300); c.lineTo(580, 300); c.stroke(); },
  vanity(c, w, h) { c.strokeRect(110, 300, 420, 160); c.beginPath(); c.moveTo(320, 300); c.lineTo(320, 460); c.stroke(); c.beginPath(); c.ellipse(320, 290, 120, 20, 0, 0, 7); c.stroke(); c.strokeRect(190, 80, 260, 170); },
  tvwall(c, w, h) { c.strokeRect(60, 140, 520, 380); c.strokeRect(170, 200, 300, 170); c.beginPath(); c.moveTo(60, 430); c.lineTo(580, 430); c.stroke(); },
  oven(c, w, h) { c.strokeRect(150, 150, 340, 340); c.strokeRect(190, 240, 260, 200); c.beginPath(); c.moveTo(190, 200); c.lineTo(450, 200); c.stroke(); },
  hob(c, w, h) { c.strokeRect(90, 190, 460, 260); for (const [x, y, r] of [[200, 270, 50], [200, 380, 40], [430, 320, 80]]) { c.beginPath(); c.arc(x, y, r, 0, 7); c.stroke(); } },
  fridge(c, w, h) { c.strokeRect(200, 70, 240, 500); c.beginPath(); c.moveTo(200, 270); c.lineTo(440, 270); c.stroke(); },
  hood(c, w, h) { c.beginPath(); c.moveTo(280, 80); c.lineTo(280, 300); c.lineTo(120, 420); c.lineTo(520, 420); c.lineTo(360, 300); c.lineTo(360, 80); c.stroke(); },
  ac(c, w, h) { rr(c, 70, 230, 500, 160, 30); c.stroke(); c.beginPath(); c.moveTo(110, 350); c.lineTo(530, 350); c.stroke(); },
  hinge(c, w, h) { c.strokeRect(160, 260, 160, 120); c.beginPath(); c.arc(240, 320, 45, 0, 7); c.stroke(); c.strokeRect(320, 290, 160, 60); },
  handle(c, w, h) { c.strokeRect(140, 280, 360, 80); rr(c, 180, 300, 280, 40, 18); c.stroke(); },
};
function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }

/**
 * Create an image Blob for a library item.
 * desc: { t: 'wood'|'marble'|...|'product', color, ...opts } or { t:'product', draw:'downlight', bg }
 */
export async function makeTexture(desc, seed = 1) {
  const rand = rng(seed * 9301 + 49297);
  const [c, ctx] = mk(640, 640);
  if (desc.t === 'product') {
    ctx.fillStyle = desc.bg || '#EFEAE2'; ctx.fillRect(0, 0, 640, 640);
    ctx.fillStyle = desc.metal ? '#D9D3C8' : 'rgba(0,0,0,0)';
    ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    (DRAW[desc.draw] || DRAW.downlight)(ctx, 640, 640);
    grain(ctx, 640, 640, 6, rand);
  } else {
    (PAINTERS[desc.t] || PAINTERS.solid)(ctx, 640, 640, desc, rand);
    grain(ctx, 640, 640, desc.noise ?? 10, rand);
  }
  return new Promise((r) => c.toBlob(r, 'image/jpeg', 0.86));
}

/** A simple dimensioned plan drawing for a room (used as an attached "drawing"). */
export async function makePlanDrawing(name, L, W) {
  const [c, x] = mk(900, 640);
  x.fillStyle = '#FBFAF7'; x.fillRect(0, 0, 900, 640);
  x.strokeStyle = '#D9D3C8'; x.lineWidth = 1;
  for (let i = 0; i < 900; i += 30) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 640); x.stroke(); }
  for (let i = 0; i < 640; i += 30) { x.beginPath(); x.moveTo(0, i); x.lineTo(900, i); x.stroke(); }
  const s = Math.min(600 / L, 400 / W);
  const w = L * s, h = W * s, ox = (900 - w) / 2, oy = (640 - h) / 2 + 10;
  x.strokeStyle = INK; x.lineWidth = 8; x.strokeRect(ox, oy, w, h);
  x.fillStyle = '#FBFAF7'; x.fillRect(ox + w * 0.15, oy - 6, 0.9 * s, 12);
  x.lineWidth = 1.5; x.beginPath(); x.arc(ox + w * 0.15, oy, 0.9 * s, 0, Math.PI / 2); x.stroke();
  x.fillStyle = INK; x.font = '15px Inter, sans-serif'; x.textAlign = 'center';
  x.fillText(`${L.toFixed(2)} m`, ox + w / 2, oy + h + 36);
  x.save(); x.translate(ox - 28, oy + h / 2); x.rotate(-Math.PI / 2); x.fillText(`${W.toFixed(2)} m`, 0, 0); x.restore();
  x.font = '600 22px Georgia, serif'; x.fillText(name.toUpperCase(), ox + w / 2, oy + h / 2);
  x.font = '13px Inter, sans-serif'; x.fillStyle = '#7F796F'; x.fillText(`${(L * W).toFixed(2)} m²`, ox + w / 2, oy + h / 2 + 24);
  x.textAlign = 'left'; x.fillText('PLAN — SCALE NTS', 24, 30);
  return new Promise((r) => c.toBlob(r, 'image/png'));
}

/** Cover image for demo projects. */
export async function makeCover(palette, seed = 3) {
  const rand = rng(seed);
  const [c, x] = mk(1400, 800);
  const g = x.createLinearGradient(0, 0, 0, 800);
  g.addColorStop(0, palette[0]); g.addColorStop(1, palette[1]);
  x.fillStyle = g; x.fillRect(0, 0, 1400, 800);
  // abstract architecture: volumes + shadows
  x.fillStyle = palette[2]; x.fillRect(180, 300, 640, 360);
  x.fillStyle = palette[3]; x.fillRect(820, 380, 420, 280);
  x.fillStyle = 'rgba(30,28,25,.18)'; x.fillRect(180, 300, 640, 40);
  x.fillStyle = palette[4];
  for (let i = 0; i < 6; i++) x.fillRect(240 + i * 95, 400, 46, 170);
  x.fillRect(880, 450, 300, 110);
  x.fillStyle = 'rgba(30,28,25,.25)'; x.fillRect(0, 660, 1400, 140);
  x.fillStyle = palette[3]; x.fillRect(0, 660, 1400, 6);
  grain(x, 1400, 800, 8, rand);
  return new Promise((r) => c.toBlob(r, 'image/jpeg', 0.85));
}
