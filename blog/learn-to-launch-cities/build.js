#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');

const MAPS = '/Users/jd/projects/juandiego-work/blog/expansion-brazil-peru/writing/assets/maps';
const OUT  = '/Users/jd/projects/juandiego-work/blog/learn-to-launch-cities/index.html';

function loadJson(name) {
  return JSON.parse(fs.readFileSync(path.join(MAPS, name), 'utf8'));
}

const lima = loadJson('lima-districts.geojson');
const sjl  = loadJson('sjl-leads.json');
const smp  = loadJson('smp-leads.json');
const tru  = loadJson('trujillo-zones.geojson');
const peru = loadJson('peru-departments.geojson');
const opp  = loadJson('opportunity-data.json');

// ── Projection ──────────────────────────────────────────────────────────
// Preserves aspect ratio: same px/degree scale on both axes.
// Centers the map within the viewport.
function mkProj(minLng, maxLng, minLat, maxLat, W, H, pad) {
  const ls = maxLng - minLng;
  const la = maxLat - minLat;
  const sc = Math.min((W - 2*pad) / ls, (H - 2*pad) / la);
  const usedW = ls * sc;
  const usedH = la * sc;
  const ox = pad + ((W - 2*pad) - usedW) / 2;
  const oy = pad + ((H - 2*pad) - usedH) / 2;
  return {
    x: lng => ox + (lng - minLng) * sc,
    y: lat => oy + (maxLat - lat) * sc,
    sc
  };
}

// ── GeoJSON → SVG path ───────────────────────────────────────────────────
function geoToD(geom, p, dp = 1) {
  function ring2path(ring) {
    return ring
      .map((c, i) => (i ? 'L' : 'M') + p.x(c[0]).toFixed(dp) + ',' + p.y(c[1]).toFixed(dp))
      .join('') + 'Z';
  }
  if (geom.type === 'Polygon')
    return geom.coordinates.map(ring2path).join(' ');
  if (geom.type === 'MultiPolygon')
    return geom.coordinates.map(poly => poly.map(ring2path).join(' ')).join(' ');
  return '';
}

// ── Bounding-box centroid of a geometry ─────────────────────────────────
function bboxCenter(geom) {
  let x0=Infinity, x1=-Infinity, y0=Infinity, y1=-Infinity;
  function walk(c) {
    if (typeof c[0] === 'number') {
      if (c[0]<x0) x0=c[0]; if (c[0]>x1) x1=c[0];
      if (c[1]<y0) y0=c[1]; if (c[1]>y1) y1=c[1];
    } else c.forEach(walk);
  }
  walk(geom.coordinates);
  return { lng: (x0+x1)/2, lat: (y0+y1)/2 };
}

// ── Leads → SVG circle elements ─────────────────────────────────────────
function leadsCircles(pts, p, r) {
  return pts.map(pt =>
    `<circle cx="${p.x(pt[0]).toFixed(1)}" cy="${p.y(pt[1]).toFixed(1)}" r="${r}"/>`
  ).join('');
}

// ════════════════════════════════════════════════════════════════════════
// GRAPHIC 1 — Lima
// ════════════════════════════════════════════════════════════════════════
const G1W = 520, G1H = 830;
const lp = mkProj(-77.1983, -76.62179, -12.51887, -11.57324, G1W, G1H, 28);

let g1ctx = '', g1sjlD = '', g1smpD = '';
let sjlC = {x:0,y:0}, smpC = {x:0,y:0};

for (const f of lima.features) {
  const d = geoToD(f.geometry, lp);
  if (f.properties.role === 'expanded') {
    const c = bboxCenter(f.geometry);
    if (f.properties.district === 'San Juan De Lurigancho') {
      g1sjlD = d; sjlC = {x: lp.x(c.lng), y: lp.y(c.lat)};
    } else {
      g1smpD = d; smpC = {x: lp.x(c.lng), y: lp.y(c.lat)};
    }
  } else {
    g1ctx += `<path d="${d}"/>`;
  }
}

const g1sjlCircles = leadsCircles(sjl, lp, 1.0);
const g1smpCircles = leadsCircles(smp, lp, 1.0);

// ════════════════════════════════════════════════════════════════════════
// GRAPHIC 2 — Peru locator + Trujillo zones (two panels, one SVG)
// ════════════════════════════════════════════════════════════════════════
const G2W = 640, G2H = 300;
// Left panel: Peru, x ∈ [0, 165]
const PP_W = 165, PP_H = 300;
// Right panel: Trujillo, x ∈ [185, 640]  →  inner width 455
const TP_X = 185, TP_W = 455, TP_H = 300;

const pp = mkProj(-81.29862, -68.67265, -18.32499, -0.08096, PP_W, PP_H, 8);

// Trujillo proj is computed in its own 455×300 space, then offset by TP_X
const tp0 = mkProj(-79.07029, -78.96184, -8.19827, -8.07177, TP_W, TP_H, 15);
const tp  = { x: lng => tp0.x(lng) + TP_X, y: lat => tp0.y(lat) };

// Peru department paths
let peruCtx = '', peruHL = '';
for (const f of peru.features) {
  const d = geoToD(f.geometry, pp);
  if (f.properties.role === 'highlight') peruHL = d;
  else peruCtx += `<path d="${d}"/>`;
}

// Trujillo marker on Peru map
const tPtX = pp.x(-79.01353).toFixed(1);
const tPtY = pp.y(-8.1318).toFixed(1);

// Trujillo zone paths + labels
let truOpened = '', truEval = '', truLabels = '';
const ZONE_ABBREV = {
  'Victor Larco Herrera': 'Víctor Larco H.',
  'El Porvenir': 'El Porvenir',
  'La Esperanza': 'La Esperanza',
  'Trujillo': 'Trujillo',
  'Moche': 'Moche'
};

// Manual label offsets for Trujillo zones (dy from centroid, in SVG units)
// These are tuned for the 455×300 panel at scale ~2134 px/degree
const ZONE_OFFSETS = {
  'Trujillo':           { dx:  0, dy: -4 },
  'Victor Larco Herrera': { dx: -10, dy: 10 },
  'Moche':              { dx:  0, dy:  4 },
  'El Porvenir':        { dx:  0, dy: -4 },
  'La Esperanza':       { dx:  0, dy: -4 }
};

for (const f of tru.features) {
  const d = geoToD(f.geometry, tp);
  const c = bboxCenter(f.geometry);
  const off = ZONE_OFFSETS[f.properties.zone] || {dx:0, dy:0};
  const lx  = (tp.x(c.lng) + off.dx).toFixed(1);
  const ly  = (tp.y(c.lat) + off.dy).toFixed(1);
  const name = ZONE_ABBREV[f.properties.zone] || f.properties.zone;

  if (f.properties.role === 'opened') {
    truOpened += `<path d="${d}"/>`;
    truLabels += `<text x="${lx}" y="${ly}" class="zl zo">${name}</text>`;
  } else {
    truEval += `<path d="${d}"/>`;
    truLabels += `<text x="${lx}" y="${ly}" class="zl ze">${name}</text>`;
  }
}

// ════════════════════════════════════════════════════════════════════════
// GRAPHIC 3 — Opportunity table (HTML)
// ════════════════════════════════════════════════════════════════════════
function fmtUSD(n) {
  if (n >= 1e6) return '$' + (n/1e6).toFixed(1) + 'm';
  if (n >= 1e3) return '$' + Math.round(n/1e3) + 'k';
  return '$' + n;
}

function oppRow(r, extra = '') {
  return `
        <tr${extra}>
          <td class="city">${r.city}</td>
          <td>${r.region}</td>
          <td class="num">${fmtUSD(r.fb_spend_monthly)}</td>
          <td class="num">${fmtUSD(r.favo_share_3pct)}</td>
        </tr>`;
}

function subtotalRow(label, total) {
  return `
        <tr class="subtotal">
          <td colspan="2">${label}</td>
          <td class="num">${fmtUSD(total.fb_spend_monthly)}</td>
          <td class="num">${fmtUSD(total.favo_share_3pct)}</td>
        </tr>`;
}

const oppTableRows =
  // Lima header
  `
        <tr class="ref-row">
          <td class="city">Lima</td>
          <td>${opp.lima.region}</td>
          <td class="num">${fmtUSD(opp.lima.fb_spend_monthly)}</td>
          <td class="num">${fmtUSD(opp.lima.favo_share_3pct)}</td>
        </tr>` +
  // Group 1
  `
        <tr class="group-head"><td colspan="4">${opp.group1.label}</td></tr>` +
  opp.group1.rows.map(r => oppRow(r, r.top_pick ? ' class="top-pick"' : '')).join('') +
  subtotalRow('Group 1 total', opp.group1.total) +
  // Group 2
  `
        <tr class="group-head"><td colspan="4">${opp.group2.label}</td></tr>` +
  opp.group2.rows.map(r => oppRow(r)).join('') +
  subtotalRow('Group 2 total', opp.group2.total) +
  // Grand total
  `
        <tr class="grand-total">
          <td colspan="2">Total addressable</td>
          <td class="num">${fmtUSD(opp.grand_total.fb_spend_monthly)}</td>
          <td class="num">${fmtUSD(opp.grand_total.favo_share_3pct)}</td>
        </tr>`;

// ════════════════════════════════════════════════════════════════════════
// HTML
// ════════════════════════════════════════════════════════════════════════
const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>They sent me to learn how to launch cities. Then I launched one. — JD Peñaherrera</title>
<meta name="description" content="A few months into Favo, they put me on a plane to learn how to launch cities from operators who'd done it at Rappi, 99, and Didi. Then they gave me one of my own — in Peru, in two months. Here's what it taught me.">
<link rel="icon" type="image/jpeg" href="/JD_PFP.jpeg">
<link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400;1,6..72,500&family=Public+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --ink-900:#00172E; --ink-850:#05162C; --ink-700:#002B57;
  --blue-600:#0E72DA; --blue-500:#0D84FF; --blue-300:#B2D5FF;
  --blue-100:#F0F7FF; --blue-050:#EFF9FE;
  --slate-600:#597597; --slate-500:#798594;
  --paper:#FAFDFF; --surface-100:#F2F3F9;
  --text-primary:var(--ink-900); --text-secondary:var(--ink-700);
  --text-muted:var(--slate-600); --text-caption:var(--slate-500);
  --text-accent:var(--blue-500);
  --border-subtle:rgba(0,23,46,0.10); --border-strong:rgba(0,23,46,0.22);
  --rule:rgba(0,23,46,0.14);
  --font-serif:'Newsreader',Georgia,serif;
  --font-sans:'Public Sans','Helvetica Neue',Arial,sans-serif;
  --font-mono:'IBM Plex Mono',ui-monospace,Menlo,monospace;
  --weight-medium:500; --weight-semibold:600;
  --tracking-display:-0.03em; --tracking-eyebrow:0.06em;
  --ease-out:cubic-bezier(0.22,1,0.36,1);
  --dur-fast:140ms; --dur-base:240ms;
}
html,body{min-height:100%;}
body{
  font-family:var(--font-sans);
  background:var(--paper);
  color:var(--text-primary);
  display:flex;flex-direction:column;
  -webkit-font-smoothing:antialiased;
}

/* NAV */
nav{
  border-bottom:1px solid var(--border-subtle);
  display:flex;align-items:center;justify-content:space-between;
  padding:0 4rem;height:56px;flex-shrink:0;
  background:var(--paper);
  position:sticky;top:0;z-index:10;
}
.nav-logo{
  font-family:var(--font-serif);font-size:19px;font-weight:var(--weight-medium);
  letter-spacing:-0.02em;color:var(--text-primary);text-decoration:none;
}
.nav-logo em{font-style:italic;}
.nav-links{display:flex;gap:3rem;align-items:center;}
.nav-link{
  font-family:var(--font-sans);font-size:12px;font-weight:var(--weight-semibold);
  letter-spacing:var(--tracking-eyebrow);text-transform:uppercase;
  color:var(--text-muted);text-decoration:none;
  transition:color var(--dur-fast) var(--ease-out);
}
.nav-link:hover{color:var(--text-primary);}
.nav-link.active{color:var(--text-primary);}

/* LAYOUT */
main{flex:1;}
.article-page{max-width:720px;margin:0 auto;padding:5rem 4rem 6rem;width:100%;}

/* ARTICLE HEADER */
.eyebrow{
  font-family:var(--font-sans);font-size:12px;font-weight:var(--weight-semibold);
  letter-spacing:var(--tracking-eyebrow);text-transform:uppercase;
  color:var(--text-accent);margin-bottom:1rem;
}
.accent-rule{
  width:40px;height:3px;background:var(--blue-500);border:none;
  margin-bottom:1.75rem;
}
.article-title{
  font-family:var(--font-serif);
  font-size:clamp(1.875rem,3.4vw,2.875rem);
  font-weight:var(--weight-medium);
  line-height:1.06;letter-spacing:var(--tracking-display);
  color:var(--text-primary);margin-bottom:1.25rem;
  text-wrap:balance;
}
.article-title em{font-style:italic;}
.article-meta{
  display:flex;align-items:center;gap:.75rem;
  font-family:var(--font-mono);font-size:12px;letter-spacing:0.04em;
  color:var(--text-caption);
  padding-bottom:2.75rem;
  border-bottom:1px solid var(--border-subtle);
  margin-bottom:2.75rem;
}
.meta-sep{color:var(--border-strong);}

/* ARTICLE BODY */
.article-body p{
  font-family:var(--font-sans);
  font-size:0.97rem;line-height:1.75;
  color:var(--text-primary);margin-bottom:1.5rem;
}
.article-body .article-lede{
  font-family:var(--font-serif);font-style:italic;
  font-size:1.25rem;line-height:1.5;
  color:var(--text-secondary);
  margin-bottom:1.75rem;
}
.article-body h2{
  font-family:var(--font-serif);
  font-size:1.5rem;font-weight:var(--weight-medium);
  line-height:1.15;letter-spacing:-0.015em;
  color:var(--text-primary);
  margin:3.5rem 0 1rem;
}
.article-body h2 em{font-style:italic;}
.article-body strong{font-weight:var(--weight-semibold);color:var(--text-primary);}
.article-body em{font-style:italic;}
.article-body a{color:var(--text-accent);text-decoration:underline;text-underline-offset:3px;}
.article-body a:hover{color:var(--blue-600);}

/* FOOTNOTE REF */
.fn-ref{
  font-family:var(--font-mono);font-size:10px;letter-spacing:0.02em;
  color:var(--text-muted);text-decoration:none;vertical-align:super;
  transition:color var(--dur-fast) var(--ease-out);
}
.fn-ref:hover{color:var(--blue-500);}

/* MAP FIGURE */
.map-figure{margin:2.5rem 0;}
.map-figure svg{width:100%;height:auto;display:block;}
.map-note{
  font-family:var(--font-mono);font-size:11px;letter-spacing:0.03em;
  color:var(--text-caption);margin-top:1rem;line-height:1.6;
}

/* OPPORTUNITY TABLE */
.opp-wrap{margin:2.5rem 0;overflow-x:auto;}
.opp-table{
  width:100%;border-collapse:collapse;
  font-family:var(--font-sans);font-size:0.84rem;
  color:var(--text-primary);
}
.opp-table th{
  font-family:var(--font-mono);font-size:10px;font-weight:var(--weight-medium);
  letter-spacing:0.08em;text-transform:uppercase;color:var(--text-caption);
  padding:.5rem .75rem .4rem;text-align:left;border-bottom:1px solid var(--border-strong);
}
.opp-table th.num{text-align:right;}
.opp-table td{
  padding:.5rem .75rem;border-bottom:1px solid var(--border-subtle);
  vertical-align:top;color:var(--text-primary);
}
.opp-table td.num{text-align:right;font-family:var(--font-mono);font-size:0.82rem;letter-spacing:0.02em;}
.opp-table td.city{font-weight:var(--weight-medium);}
.opp-table .ref-row td{color:var(--text-muted);font-size:0.82rem;}
.opp-table .group-head td{
  font-family:var(--font-mono);font-size:10px;letter-spacing:0.07em;text-transform:uppercase;
  color:var(--text-caption);padding:.9rem .75rem .3rem;
  border-bottom:none;
}
.opp-table .subtotal td{
  font-family:var(--font-mono);font-size:11px;letter-spacing:0.03em;
  color:var(--text-muted);background:var(--surface-100);
  border-top:1px solid var(--border-subtle);
  border-bottom:1px solid var(--border-strong);
}
.opp-table .top-pick td{background:var(--blue-050);border-bottom:1px solid var(--border-subtle);}
.opp-table .top-pick td.city::after{
  content:'top pick';
  display:inline-block;margin-left:.5rem;
  font-family:var(--font-mono);font-size:9px;letter-spacing:0.08em;text-transform:uppercase;
  color:var(--blue-500);vertical-align:middle;
  background:rgba(13,132,255,0.08);padding:1px 5px;border-radius:3px;
}
.opp-table .grand-total td{
  font-family:var(--font-mono);font-size:12px;letter-spacing:0.03em;font-weight:var(--weight-medium);
  color:var(--text-primary);border-top:2px solid var(--border-strong);border-bottom:none;
  padding:.65rem .75rem;
}
.opp-source{
  font-family:var(--font-mono);font-size:10px;letter-spacing:0.03em;
  color:var(--text-caption);margin-top:.75rem;line-height:1.5;
}

/* FOOTER */
footer{
  border-top:1px solid var(--border-subtle);
  padding:1.25rem 4rem;
  display:flex;justify-content:space-between;align-items:center;
  flex-shrink:0;
}
.footer-link{
  font-family:var(--font-sans);font-size:12px;font-weight:var(--weight-semibold);
  letter-spacing:var(--tracking-eyebrow);text-transform:uppercase;
  color:var(--text-muted);text-decoration:none;
  transition:color var(--dur-fast) var(--ease-out);
}
.footer-link:hover{color:var(--text-primary);}
.footer-copy{
  font-family:var(--font-mono);font-size:11px;letter-spacing:0.04em;
  color:var(--text-caption);
}

/* RESPONSIVE */
@media(max-width:600px){
  nav{padding:0 1.25rem;}
  .nav-links{gap:1.5rem;}
  .article-page{padding:3.5rem 1.25rem 5rem;}
  footer{padding:1.25rem;flex-direction:column;gap:.5rem;text-align:center;}
}
</style>
</head>
<body>

<nav>
  <a class="nav-logo" href="/"><em>JD</em></a>
  <div class="nav-links">
    <a class="nav-link" href="/experience">Experience</a>
    <a class="nav-link active" href="/blog">Writing</a>
  </div>
</nav>

<main>
<div class="article-page">

  <p class="eyebrow">Operator learnings</p>
  <hr class="accent-rule">
  <h1 class="article-title">They sent me to learn how to launch cities.<br>Then I <em>launched</em> one.</h1>
  <div class="article-meta">
    <time datetime="2026-06">Jun 2026</time>
    <span class="meta-sep">·</span>
    <span>9 min read</span>
  </div>

  <div class="article-body">

    <p class="article-lede">A few months into my time at Favo, the company put me on a plane to São Paulo to learn how to launch cities — from people who had actually done it. The rooms were full of operators and founders who'd built expansion at the companies you'd recognize: Rappi, 99, Didi. I was the youngest person in them by a wide margin, and the least experienced by more. A few weeks later, they handed me a city of my own.</p>

    <p>I want to tell that honestly, because the clean version — <em>"I learned the playbook and ran it"</em> — leaves out the part that actually mattered. I didn't have the experience the job asked for. I moved faster than I was comfortable moving. And the thing I built well still didn't get to scale. All three are true at the same time. That's usually how it goes.</p>

    <h2>The map that got me <em>noticed</em></h2>

    <p>Before expansion was ever my job, I'd built a way to look at Lima that nobody else had.</p>

    <p>The idea was simple and tedious: cut the city into quadrants of 400 by 400 meters, and score each one — population, how much it spent on food, socio-economic level. The original goal had nothing to do with expansion. I wanted to <em>densify</em> — to find which blocks could hold more community leaders so our logistics got more efficient as we grew. Then the market shifted under me, and I realized the same map answered a different question: <em>where could we go that we weren't already?</em></p>

    <p>We had thousands of people who wanted a Favo store and couldn't get one, because our logistics didn't reach them. I matched that latent demand against the quadrants nobody was serving, and flagged only the ones where demand was dense enough that a delivery route would actually pay for itself. That last filter is the whole game in this business. You don't expand to where there are customers. You expand to where there are <em>enough</em> customers, close enough together, that the truck makes money.</p>

    <p>The raw lead count wasn't the impressive part. It was that the map found opportunity where nobody had thought to look. That's what got me noticed — and it's why, a few weeks later, I was on a plane to Brazil.</p>

    <!-- ── GRAPHIC 1: Lima map ── -->
    <figure class="map-figure" role="img" aria-labelledby="g1-title" aria-describedby="g1-desc">
      <svg viewBox="0 0 ${G1W} ${G1H}" xmlns="http://www.w3.org/2000/svg"
           style="font-family:'IBM Plex Mono',monospace;">
        <title id="g1-title">Finding the opportunity in Lima</title>
        <desc id="g1-desc">Lima metro divided into districts. San Juan de Lurigancho in the northeast and San Martín de Porres in the north are highlighted in blue, with a density cloud of community-leader leads mapped inside each one.</desc>

        <!-- Context districts -->
        <g fill="rgba(0,23,46,0.02)" stroke="rgba(0,23,46,0.16)" stroke-width="0.5"
           fill-rule="evenodd" stroke-linejoin="round">
          ${g1ctx}
        </g>

        <!-- Expanded districts: SJL + SMP — faint accent fill -->
        <g fill="rgba(13,132,255,0.07)" stroke="rgba(13,132,255,0.55)" stroke-width="0.8"
           fill-rule="evenodd" stroke-linejoin="round">
          <path d="${g1sjlD}"/>
          <path d="${g1smpD}"/>
        </g>

        <!-- SJL lead dots -->
        <g fill="#0D84FF" opacity="0.38">
          ${g1sjlCircles}
        </g>

        <!-- SMP lead dots -->
        <g fill="#0D84FF" opacity="0.38">
          ${g1smpCircles}
        </g>

        <!-- District labels -->
        <text x="${(sjlC.x).toFixed(1)}" y="${(sjlC.y - 6).toFixed(1)}"
              font-size="8.5" fill="#0D84FF" text-anchor="middle"
              font-family="'Public Sans',sans-serif" font-weight="600"
              letter-spacing="0.04em">San Juan de</text>
        <text x="${(sjlC.x).toFixed(1)}" y="${(sjlC.y + 5).toFixed(1)}"
              font-size="8.5" fill="#0D84FF" text-anchor="middle"
              font-family="'Public Sans',sans-serif" font-weight="600"
              letter-spacing="0.04em">Lurigancho</text>

        <text x="${(smpC.x).toFixed(1)}" y="${(smpC.y - 6).toFixed(1)}"
              font-size="8.5" fill="#0D84FF" text-anchor="middle"
              font-family="'Public Sans',sans-serif" font-weight="600"
              letter-spacing="0.04em">San Martín de</text>
        <text x="${(smpC.x).toFixed(1)}" y="${(smpC.y + 5).toFixed(1)}"
              font-size="8.5" fill="#0D84FF" text-anchor="middle"
              font-family="'Public Sans',sans-serif" font-weight="600"
              letter-spacing="0.04em">Porres</text>
      </svg>
      <p class="map-note" id="g1-desc-visible">Lima, sliced into 400×400 m quadrants and scored by spend and socio-economic level. Each dot is a community-leader lead I identified inside the two districts I relaunched — San Juan de Lurigancho and San Martín de Porres.</p>
    </figure>

    <h2>Learning to launch, by <em>launching</em></h2>

    <p>I didn't go to Brazil to observe. I went to do the job badly at first and get better fast.</p>

    <p>I shadowed offline operations, sat in on every launch call for two other cities, rode along on visits to logistics operators, and read the playbook the team had written from a dozen prior launches. Then they gave me Campinas. I co-led it — and I want to be precise about that word. I wasn't the expert parachuting in. I was the new person learning how a launch actually works, while more senior operators carried the parts I couldn't yet.</p>

    <p>The playbook itself is less mysterious than it sounds. You forecast demand for the city, and that forecast sizes the distribution center. You prioritize zones by opportunity and logistics viability. You build a waiting list before you open. You launch organic first, then turn on paid to that list, then open the whole city only once logistics can actually carry it. You acquire community leaders through paid, referrals, and feet-on-the-street offline — in that order of cost. Campinas taught me the playbook in my hands instead of on a slide.</p>

    <h2>Appointed <em>before</em> I was ready</h2>

    <p>Then they appointed me to lead the expansion in Peru, working alongside the CEO and COO.</p>

    <p>On paper that's a promotion. In my head it was a problem I didn't know how to solve. I'd co-led exactly one launch. And the strategy wasn't handed to me — it was my recommendation. I built the case for what expansion in Peru should actually be: relaunch our strongest districts in Lima, <em>and</em> launch an entirely new city from scratch. I brought the analysis to the CEO and COO and we shaped it together, but the bet, the numbers, and the launch plan were mine. That recommendation is what put me back on the map as an operator — and it meant I now owned the thing I'd argued for.</p>

    <p>I chose the city the same way I'd found the districts — through the opportunity lens. I pressure-tested several regions on market size, banking and internet penetration, logistics viability, and proximity to the <em>next</em> cities we'd want after it. Trujillo won.</p>

    <!-- ── GRAPHIC 3: Opportunity table — right after "Trujillo won." ── -->
    <div class="opp-wrap" role="region" aria-label="Expansion opportunity table">
      <table class="opp-table">
        <thead>
          <tr>
            <th>City</th>
            <th>Region</th>
            <th class="num">Monthly F&amp;B spend</th>
            <th class="num">Favo share @ 3%</th>
          </tr>
        </thead>
        <tbody>
          ${oppTableRows}
        </tbody>
      </table>
      <p class="opp-source">Sources: ${opp.sources}</p>
    </div>

    <p>I had the playbook. I did not have the experience. The gap between those two is where I lived for the next several months.</p>

    <h2>Two months to <em>launch</em> a city</h2>

    <!-- ── GRAPHIC 2: Peru locator + Trujillo zones ── -->
    <figure class="map-figure" role="img" aria-labelledby="g2-title" aria-describedby="g2-desc">
      <svg viewBox="0 0 ${G2W} ${G2H}" xmlns="http://www.w3.org/2000/svg"
           style="font-family:'IBM Plex Mono',monospace;">
        <title id="g2-title">Where Trujillo is, and what we opened</title>
        <desc id="g2-desc">Left: Peru outline with La Libertad department highlighted in blue and a dot marking Trujillo. Right: Trujillo zone map showing three opened zones filled in blue and two evaluated zones with dashed outlines.</desc>

        <!-- ── LEFT: Peru locator ── -->
        <g fill="none" stroke="rgba(0,23,46,0.18)" stroke-width="0.4"
           stroke-linejoin="round">
          ${peruCtx}
        </g>
        <!-- La Libertad highlight -->
        <path d="${peruHL}" fill="rgba(13,132,255,0.20)" stroke="#0D84FF"
              stroke-width="0.6" stroke-linejoin="round" fill-rule="evenodd"/>
        <!-- Trujillo marker -->
        <circle cx="${tPtX}" cy="${tPtY}" r="3" fill="#0D84FF"/>
        <!-- "Trujillo" label -->
        <text x="${tPtX}" y="${(parseFloat(tPtY) - 5).toFixed(1)}"
              font-size="7" fill="#0D84FF" text-anchor="middle"
              font-family="'Public Sans',sans-serif" font-weight="600"
              letter-spacing="0.04em">Trujillo</text>

        <!-- Panel divider -->
        <line x1="${TP_X - 10}" y1="16" x2="${TP_X - 10}" y2="${G2H - 16}"
              stroke="rgba(0,23,46,0.10)" stroke-width="0.5"/>

        <!-- ── RIGHT: Trujillo zones ── -->
        <!-- Opened zones -->
        <g fill="rgba(13,132,255,0.18)" stroke="#0D84FF" stroke-width="0.7"
           fill-rule="evenodd" stroke-linejoin="round">
          ${truOpened}
        </g>
        <!-- Evaluated zones — dashed outline, no fill -->
        <g fill="none" stroke="rgba(0,23,46,0.30)" stroke-width="0.7"
           stroke-dasharray="3,2" stroke-linejoin="round">
          ${truEval}
        </g>
        <!-- Zone labels -->
        <style>
          .zl{font-size:7.5px;text-anchor:middle;font-family:'Public Sans',sans-serif;letter-spacing:0.03em;}
          .zo{fill:#0D84FF;}
          .ze{fill:#597597;}
        </style>
        ${truLabels}

        <!-- Legend -->
        <circle cx="${TP_X + 8}" cy="${G2H - 14}" r="3.5" fill="rgba(13,132,255,0.18)" stroke="#0D84FF" stroke-width="0.7"/>
        <text x="${TP_X + 15}" y="${G2H - 10}" font-size="7" fill="#597597"
              font-family="'Public Sans',sans-serif">opened (wave 1)</text>
        <circle cx="${TP_X + 120}" cy="${G2H - 14}" r="3.5" fill="none" stroke="rgba(0,23,46,0.30)" stroke-width="0.7" stroke-dasharray="2,2"/>
        <text x="${TP_X + 128}" y="${G2H - 10}" font-size="7" fill="#597597"
              font-family="'Public Sans',sans-serif">evaluated, held back</text>
      </svg>
      <p class="map-note" id="g2-desc-visible">I assessed regions on market size, accessibility, banking and internet penetration, and proximity to the next cities. Trujillo won. We opened three zones in the first wave and held back the two highest-risk ones.</p>
    </figure>

    <p>Here's the part that still surprises me. We decided to do it in December, started operations in mid-January, and delivered the first order on February 15. Roughly two months from decision to live. About one month from the first day of operations to the first sale.</p>

    <p>In that window I hired a team from scratch — coordinators, analysts, interns, an offline lead — and ran a budget that, across the whole expansion, came to around a million dollars. I owned the forecasts, the burn plan, and the launch strategy. The big operating call — run the distribution ourselves instead of outsourcing it — we made together: me with the CEO, the COO, and the logistics director, each of us leaning on what we knew. The logistics director built the distribution center and stood up the warehouse system; my job was the demand, the numbers, and the launch plan that sat on top of it. Running it ourselves was the right call and an expensive one in the short term — it landed late and slipped the launch twice while the infrastructure got built and the team got trained.</p>

    <p>Launch day was humbling. We had more than a thousand stores ready to sell, the data pipeline broke, and for a day we were flying blind — and we sold ten orders. I was in Trujillo for it. I spent those days doing offline acquisition myself, alongside the team — selling and recruiting in the field, learning what actually worked and coaching them on it — because I wasn't going to ask people to do something I hadn't done. I rode along with the distribution trucks a few times too, just enough to understand how the operation really moved.</p>

    <p>When the numbers came in soft, we got aggressive. In about two days we improvised a launch event on the Plaza de Armas — a hotel ballroom, a mobile billboard circling the square, the CEO flying in to meet entrepreneurs face to face. We invited every community leader we could reach; over a hundred confirmed. By the end of the first full week, the city beat its sales target. And when we later moved offline recruiting in-house instead of through an agency, our cost to acquire a leader dropped from around 131 dollars to 11 — the same work, done by people who actually understood the city.</p>

    <p>The pressure came from every direction at once — the CEO, the COO, the CGO — and I was building two things in parallel: the Lima relaunch and the Trujillo launch. Most days I had no clean view of how I was going to solve the thing in front of me. I solved it anyway, one piece at a time, and the next morning there was another one.</p>

    <h2>The rule that worked in Brazil and <em>broke</em> in Peru</h2>

    <p>The mistake that taught me the most wasn't an execution failure. It was a copied assumption.</p>

    <p>We brought Brazil's coupon and fraud rules to Peru more or less intact — they worked there, so why wouldn't they work here? Because the way people game a system is local. In Peru, entrepreneurs found a hole we hadn't seen: they turned first-order coupons into an arbitrage, in patterns our Brazilian rules weren't written to catch. By the time we'd identified more than a hundred of them, we'd generated close to twenty thousand dollars in fraud — and we couldn't even cleanly claw it back, because we'd never explained the rules to those entrepreneurs upfront. Clawing it back would have meant breaking trust with the very people we'd just spent months recruiting.</p>

    <p>That's the lesson I keep returning to: <strong>a playbook is a hypothesis, not a guarantee.</strong> What worked in one country is a starting point, not an answer. The fraud patterns, the logistics, the way people behave, what earns their trust — all of it is local, and all of it has to reshape the plan. Port the thinking. Don't port the rules.</p>

    <h2>What it was, and what it <em>wasn't</em></h2>

    <p>I'll be precise, because precise is the honest version. I launched the city well. The expansion still didn't work.</p>

    <p>Right as we were getting going, the capital markets turned — the same shift that would define that whole year<a href="https://sequoiacap.com/article/adapting-to-endure/" target="_blank" rel="noopener noreferrer" class="fn-ref">[1]</a>. Money stopped being free, and for a startup burning cash to grow across two countries, that wasn't a headline. It was a deadline. The forecast I'd built got cut hard. Hiring froze. The expansion that needed time to compound never got it. It was supposed to work, and it didn't — not because the launch was wrong, but because the fight was being decided well above my role.</p>

    <p>So I did the thing the moment required. I handed the operation to someone else and went to go cut logistics costs out of the business — which became the next bet, and its own story.</p>

    <h2>Trusted before I was <em>ready</em></h2>

    <p>The honest truth is I didn't have the experience for any of it — not the launch, not the team, not sitting across from people a decade ahead of me as the one who was supposed to have the answers. The feeling that I was out of my depth wasn't insecurity. It was accurate.</p>

    <p>But freezing was the only move guaranteed to fail. If I froze, I failed for certain. If I worked the problem as well as I knew how, I might fail — or I might not. So I worked it: long hours, first principles, one piece at a time. And being trusted with one hard, half-defined thing before I was ready is exactly what got me trusted with the next. A map became a city. A city became a bigger mandate. None of it because I was ready — all of it because I'd shown I'd start anyway.</p>

    <p class="article-lede">The people who get handed the hard problems aren't the ones who waited to feel qualified. The cost of saying yes before you're ready is a few months of feeling like a fraud. The cost of waiting is the problem going to someone else.</p>

  </div>
</div>
</main>

<footer>
  <a class="footer-link" href="/blog">← Writing</a>
  <span class="footer-copy">© 2026 JD Peñaherrera</span>
</footer>

</body>
</html>`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html, 'utf8');
console.log('Written:', OUT);
console.log('Size:', (html.length / 1024).toFixed(1), 'KB');
