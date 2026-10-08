// node test.js — padne na prvom zlom výpočte. Žiadne frameworky.
const assert = require('assert/strict');
const { eur, split, compute, ibanOk, payUrl, summaryText } = require('./calc.js');

const sum = a => a.reduce((x, y) => x + y, 0);
const food = (id, name, q, c) => ({ id, name, q, c: eur(c) });
const one = (name, f, q = 1, me = false) => ({ name, me, items: [{ f, q }] });
const totals = r => r.rows.map(x => x.total);

assert.equal(eur('19,60'), 1960); assert.equal(eur('5.6'), 560); assert(isNaN(eur(''))); assert(isNaN(eur('abc')));

// zaokrúhlenie: súčet vždy presne total
assert.deepEqual(split(153, [727, 540, 540]), [61, 46, 46]);
assert.deepEqual(split(1000, [1, 1, 1]), [334, 333, 333]);
for (const t of [-457, -1, 0, 1, 99, 1000]) assert.equal(sum(split(t, [3, 7, 1, 13])), t);

// reálna Bolt objednávka: 7,27 + 5,40 + 5,40, extra 1,53 (0,51 každému), celkom 19,60 -> 7,78 / 5,91 / 5,91
const bolt = { foods: [food(1, 'Tanier', 1, '7,27'), food(2, 'Box', 1, '5,40'), food(3, 'Doner', 1, '5,40')],
  people: [one('Jano', 1), one('Mária', 2), one('Peter', 3)] };
for (const extra of [{ mode: 'A', c: eur('1,53') }, { mode: 'B', c: eur('19,60') }]) {
  const r = compute({ ...bolt, extra });
  assert.deepEqual(totals(r), [778, 591, 591]); assert.equal(r.total, 1960);
}

// po zaplatení Bolt ukáže len pôvodné ceny + zľavu: 9,70 / 7,20 / 7,20, zľava 6,03 -> zľavnené 7,27 / 5,40 / 5,40
const after = { foods: [food(1, 'Tanier', 1, '9,70'), food(2, 'Box', 1, '7,20'), food(3, 'Doner', 1, '7,20')], people: bolt.people };
const r0 = compute({ ...after, extra: { mode: 'B', c: eur('19,60'), discount: eur('6,03') } });
assert.deepEqual(r0.rows.map(x => x.food), [727, 540, 540]); assert.deepEqual(totals(r0), [778, 591, 591]);
assert.equal(r0.sub, 1807); assert.equal(r0.orig, 2410);
assert.deepEqual(totals(compute({ ...after, extra: { mode: 'A', c: eur('1,53'), discount: eur('6,03') } })), [778, 591, 591]);
assert.equal(after.foods[0].c, 970); // vstup sa nemení
assert.match(compute({ ...after, extra: { mode: 'A', c: 0, discount: eur('30,00') } }).errors[0], /Zľava/);

// extra sa nedelí podľa jedla: 1,54 / 3 -> zvyšný cent dostane prvý
const e = compute({ ...bolt, extra: { mode: 'A', c: eur('1,54') } });
assert.deepEqual(e.rows.map(x => x.extra), [52, 51, 51]); assert.equal(e.total, 1961);

// 3 ks za 10,00 medzi troch; 3 ks medzi dvoch v pomere 2:1
let r = compute({ foods: [food(1, 'Pizza', 3, '10,00')], people: [one('A', 1), one('B', 1), one('C', 1)], extra: { mode: 'A', c: NaN } });
assert.deepEqual(totals(r), [334, 333, 333]);
r = compute({ foods: [food(1, 'Pizza', 3, '10,00')], people: [one('A', 1, 2), one('B', 1)], extra: { mode: 'A', c: 0 } });
assert.deepEqual(totals(r), [667, 333]);

// záporný extra (zľava) a jeden človek
r = compute({ ...bolt, extra: { mode: 'B', c: eur('15,00') } }); // jedlá 18,07 > zaplatené 15,00 => záporná doprava
assert.match(r.errors[0], /záporná/); assert(!r.rows);
assert.match(compute({ ...bolt, extra: { mode: 'A', c: eur('-1,00') } }).errors[0], /záporné/);
assert.equal(compute({ ...bolt, extra: { mode: 'B', c: eur('18,07') } }).extra, 0); // presne bez dopravy je v poriadku
r = compute({ foods: [food(1, 'X', 1, '9,99')], people: [one('A', 1)], extra: { mode: 'B', c: eur('11,50') } });
assert.deepEqual(totals(r), [1150]);

// rovnaké meno (aj inak písané) = jeden podiel; platca je v súčte, ale nie v texte
r = compute({ foods: bolt.foods, people: [one('Jano', 1), one('jano ', 2), { name: 'Ja', me: true, items: [{ f: 3, q: 1 }] }], extra: { mode: 'A', c: 0 } });
assert.equal(r.rows.length, 2); assert.equal(r.rows[0].total, 1267);
assert(!summaryText(r, 'Obed 8.10.', () => '').includes('Ja —'));

// chyby: nezhoda kusov, chýbajúca suma v režime B, chýbajúca cena
assert.match(compute({ foods: [food(1, 'Pizza', 3, '10,00')], people: [one('A', 1)], extra: { mode: 'A', c: 0 } }).errors[0], /1 z 3/);
assert.match(compute({ ...bolt, extra: { mode: 'B', c: NaN } }).errors[0], /celkom/);
assert.match(compute({ foods: [food(1, 'X', 1, '')], people: [one('A', 1)], extra: { mode: 'A', c: 0 } }).errors[0], /cenu/);

// IBAN a payme odkaz (tvar odkazu z banky; IBAN je príklad z dokumentácie payme.sk)
assert(ibanOk('SK68 0720 0002 8919 8742 6353')); assert(!ibanOk('SK68 0720 0002 8919 8742 6354')); assert(!ibanOk(''));
assert.equal(payUrl('SK6807200002891987426353', 'Ján Novák', 560, 'Obed'),
  'https://www.payme.sk/2/p/PME?IBAN=SK6807200002891987426353&AM=5.60&CC=EUR&MSG=Obed&CN=J%C3%A1n+Nov%C3%A1k');

console.log('OK');
