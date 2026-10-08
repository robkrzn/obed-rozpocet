// Čistá logika bez DOM: index.html ju volá, test.js ju overuje (node test.js).
// Všetky sumy sú v celých centoch, nikdy float eurá.

function eur(s) { // "19,60" -> 1960, prázdne/nezmysel -> NaN
  s = String(s).trim().replace(',', '.');
  return s === '' || isNaN(s) ? NaN : Math.round(s * 100);
}

function fmt(c) { return (c / 100).toFixed(2).replace('.', ',') + ' €'; }

// Rozdelí `total` centov podľa celočíselných váh; súčet výsledku je vždy presne `total`
// (metóda najväčšieho zvyšku). Funguje aj pre záporné `total` (zľava).
function split(total, w) {
  const W = w.reduce((a, b) => a + b, 0);
  if (!W) return w.map(() => 0);
  const fl = w.map(x => Math.floor(total * x / W));
  const left = total - fl.reduce((a, b) => a + b, 0);
  w.map((x, i) => [total * x - fl[i] * W, i])
    .sort((a, b) => b[0] - a[0] || a[1] - b[1])
    .slice(0, left).forEach(([, i]) => fl[i]++);
  return fl;
}

// foods:  [{id, name, q (ks), c (celková suma za všetky ks, centy alebo NaN)}]
// people: [{name, me, items: [{f: foodId, q: ks}]}]
// extra:  {mode: 'A' (doprava+poplatky) | 'B' (zaplatené celkom), c: centy alebo NaN, discount: voliteľná celková zľava v centoch}
function compute({ foods, people, extra }) {
  const errors = [], byId = {};
  foods = foods.map(f => ({ ...f })); // ceny sa nižšie upravujú (zľava), vstup nemeníme
  foods.forEach((f, i) => f.label = f.name.trim() || 'Jedlo ' + (i + 1));
  foods = foods.filter(f => f.name.trim() || !isNaN(f.c));
  if (!foods.length) return { errors: ['Pridaj aspoň jedno jedlo.'] };
  foods.forEach(f => {
    byId[f.id] = f;
    if (!(f.c > 0 && Number.isInteger(f.q) && f.q >= 1)) errors.push(`${f.label}: doplň cenu a počet kusov.`);
  });

  // Zľava z výpisu Boldu po zaplatení: jedlá sú zadané za pôvodnú cenu, celková zľava sa rozdelí
  // medzi ne pomerom cien (najväčší zvyšok) -> zľavnené ceny presne ako pred platbou.
  const orig = foods.reduce((a, f) => a + (f.c > 0 ? f.c : 0), 0), D = extra.discount > 0 ? extra.discount : 0;
  if (D >= orig && D) errors.push('Zľava je väčšia alebo rovná cene jedál.');
  else if (D) split(D, foods.map(f => f.c > 0 ? f.c : 0)).forEach((d, i) => { if (foods[i].c > 0) foods[i].c -= d; });

  const P = {}; // ľudia zlúčení podľa mena => jeden podiel a jeden odkaz
  people.forEach(p => {
    const n = p.name.trim();
    if (!n) { if (p.items.length) errors.push('Doplň meno pri každom človeku.'); return; }
    const o = P[n.toLowerCase()] ||= { name: n, me: false, pcs: {} };
    o.me ||= p.me;
    p.items.forEach(it => { if (byId[it.f]) o.pcs[it.f] = (o.pcs[it.f] || 0) + (it.q >= 1 ? it.q : 0); });
  });
  const L = Object.values(P), food = L.map(() => 0);

  foods.forEach(f => {
    if (!(f.c > 0 && f.q >= 1)) return;
    const w = L.map(p => p.pcs[f.id] || 0), S = w.reduce((a, b) => a + b, 0);
    if (S !== f.q) return errors.push(`${f.label}: priradené ${S} z ${f.q} ks.`);
    split(f.c, w).forEach((c, i) => food[i] += c);
  });

  const sub = foods.reduce((a, f) => a + (f.c > 0 ? f.c : 0), 0);
  let ex = extra.c;
  if (extra.mode === 'B') {
    if (isNaN(ex)) errors.push('Zadaj, koľko si zaplatil celkom.');
    else if (ex < sub) errors.push(`Jedlá (${fmt(sub)}) sú drahšie než zaplatená suma (${fmt(ex)}), doprava by vyšla záporná. Skontroluj ceny jedál alebo zadaj zľavu.`);
    else ex -= sub;
  } else if (isNaN(ex)) ex = 0;
  else if (ex < 0) errors.push('Doprava a poplatky nemôžu byť záporné.');
  if (!L.length) errors.push('Pridaj aspoň jedného človeka.');
  if (errors.length) return { errors };

  const X = split(ex, L.map(() => 1)); // extra rovnako na hlavu (doprava je pevná suma)
  const rows = L.map((p, i) => ({ name: p.name, me: p.me, food: food[i], extra: X[i], total: food[i] + X[i] }));
  return { errors, rows, sub, extra: ex, total: sub + ex, orig, discount: D };
}

const normIban = s => s.replace(/\s/g, '').toUpperCase();

function ibanOk(s) { // tvar + kontrolný súčet mod 97 (preklep v IBANe = peniaze inam)
  s = normIban(s);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(s)) return false;
  return BigInt([...s.slice(4) + s.slice(0, 4)].map(c => parseInt(c, 36)).join('')) % 97n === 1n;
}

// Rovnaký tvar ako payme odkaz z banky (bez PI, ktoré je len pre VS/SS/KS)
function payUrl(iban, name, cents, msg) {
  const q = { IBAN: iban, AM: (cents / 100).toFixed(2), CC: 'EUR', MSG: msg, CN: name };
  return 'https://www.payme.sk/2/p/PME?' + new URLSearchParams(Object.entries(q).filter(([, v]) => v));
}

// Text do Teamsu: hlavička + riadok na človeka (bez platcu); link(row) vráti URL alebo ''
function summaryText(res, title, link) {
  const note = res.extra ? ` (doprava a poplatky ${fmt(res.extra)})` : '';
  return `${title} — celkom ${fmt(res.total)}${note}\n` +
    res.rows.filter(r => !r.me).map(r => `${r.name} — ${fmt(r.total)}` + (link(r) ? ': ' + link(r) : '')).join('\n');
}

if (typeof module !== 'undefined') module.exports = { eur, fmt, split, compute, normIban, ibanOk, payUrl, summaryText };
