# ObedRozpocet

Lokálna appka (aj PWA na telefóne) na rozpočítanie spoločnej objednávky obeda (Bolt Food a pod.)
medzi kolegov. Zadám jedlá a kto čo zjedol, doprava alebo výsledná suma → appka spočíta, koľko
má kto poslať, a vygeneruje **payme.sk odkaz** pre každého + text na skopírovanie do Teamsu.

## Súbory

| Súbor | Čo robí |
|---|---|
| `index.html` | formulár + render, vanilla JS, žiadny framework/build |
| `calc.js` | čistá logika (centy, rozdelenie, IBAN, payme URL, text do Teamsu); žiadny DOM |
| `test.js` | `node test.js` — asserty nad `calc.js`, vrátane reálnej Bolt objednávky |
| `manifest.json`, `sw.js`, `icon-*.png` | PWA (network-first s offline zálohou, netreba verzovať cache) |

Spustenie: dvojklik na `index.html` (alebo GitHub Pages). Po zmene `calc.js` vždy `node test.js`.

## Pravidlá

- **Žiadne osobné údaje v kóde ani v repe** (IBAN, meno príjemcu, adresy, screenshoty z Boldu).
  Zadávajú sa v appke (Nastavenia) a ostávajú v `localStorage` zariadenia. Testy používajú
  IBAN-príklad z dokumentácie payme.sk.
- Všetky sumy v **celých centoch**, nikdy float eurá. Zaokrúhľovanie vždy metódou najväčšieho zvyšku
  (`split` v `calc.js`), takže súčet podielov = presne zaplatená suma.
- IBAN sa pred použitím overuje (tvar + mod 97) — preklep by poslal peniaze inam.
- Commit len na pokyn používateľa (globálne pravidlo).

## Vstupy

| Pole | Poznámka |
|---|---|
| Nastavenia: meno príjemcu, IBAN, správa (default „Obed") | raz, `localStorage`; pri neplatnom IBANe sa odkazy negenerujú |
| **Jedlá:** názov + počet kusov + **celková suma** za všetky kusy | jedlo sa zadá raz |
| **Ľudia:** meno + riadky (jedlo, ks) | jedlo sa delí medzi ľudí pomerom kusov; rovnaké meno = jeden podiel; „to som ja" = platca (dostane podiel, odkaz nie) |
| **Doprava a poplatky** — režim A: extra náklady, režim B: zaplatené celkom | v B sa `extra = celkom − súčet jedál` (môže byť záporné = zľava) |

Mená, ktoré sa skopírovali, sa pamätajú na našeptávanie (`datalist`).

## Výpočet

1. Podiel človeka na jedle = celková suma jedla × jeho ks / ks jedla (najväčší zvyšok, 3 ks za 10,00 € → 3,34 + 3,33 + 3,33).
   Σ priradených ks musí = ks jedla, inak chyba („priradené 2 z 3 ks") a výsledok sa nezobrazí.
2. `extra` sa delí **proporčne podľa ceny jedla** každého človeka.
3. Spolu = jedlo + extra. Σ = zaplatená suma presne.

**Bolt:** zadávajú sa **zľavnené (červené) ceny** jedál; ich súčet = „Medzisúčet" z Boldu.
Poplatok za služby + doručenie ako `extra`, alebo rovno „Celkom" (režim B). Bolt sa neparsuje, prepisuje sa ručne.
Testovací vektor: 7,27 / 5,40 / 5,40, celkom 19,60 → **7,88 / 5,86 / 5,86**.

## Platba = payme.sk odkaz (nie PAY by square)

Pôvodný predpoklad (PAY by square + LZMA) bol zlý: QR, ktorý používateľ dnes posiela z banky,
je obyčajná URL `https://www.payme.sk/2/p/PME?IBAN=…&AM=5.60&CC=EUR&PI=…&MSG=Obed&CN=<meno>`.
Dokumentácia: <https://www.payme.sk/pre-vyvojarov>. Tým odpadla LZMA aj knižnica na QR.

`payUrl()` v `calc.js` skladá rovnaký tvar, **bez `PI`** (to je len na VS/SS/KS). Parametre: `IBAN`, `AM` (bodka, 2 desatinné),
`CC=EUR`, `MSG` (správa, default „Obed"), `CN` (meno príjemcu); kódovanie cez `URLSearchParams` (medzera = `+`, ž = `%C5%BE`),
čo sedí s odkazom z banky. Odkaz sa dá poslať kolegovi priamo — na telefóne otvorí jeho bankovú appku.

**Overenie:** `payUrl` zhoduje s tvarom z banky v teste, ale otvorenie v reálnej banke treba skúsiť ručne
(tlačidlo „test" pri odkaze, ideálne z telefónu). Ak by banka chcela `PI`, dopísať ho do `payUrl`.

## Výstup

Pri každom človeku: suma, rozpis (jedlo + extra), **Kopírovať** (riadok „Obed 8.10. — 7,88 €: odkaz") a „test" (otvorí odkaz).
Dole textarea + **Kopírovať text pre Teams**:

```
Obed 8.10. — celkom 19,60 € (doprava a poplatky 1,53 €)
Jano — 7,88 €: https://www.payme.sk/2/p/PME?…
Mária — 5,86 €: https://www.payme.sk/2/p/PME?…
```

Platca („to som ja") v texte nie je. Kontrolný riadok „Jedlá + extra = celkom" je pod zoznamom.

## Nasadenie

- **GitHub Pages**, statické súbory, bez Firebase (appka neobsahuje dáta → nie je čo zabezpečovať).
  Firebase (Auth/Firestore) až keď bude treba synchronizovať zoznam kolegov medzi zariadeniami.
- HTTPS (Pages) je potrebné pre `navigator.clipboard`; z `file://` appka padá na `execCommand('copy')`.
- PWA: „Pridať na plochu" → `localStorage` sa zachová. iOS: úložisko PWA je oddelené od Safari,
  nastavenia treba zadať znova priamo v PWA.

## Čo zámerne NEROBÍME (YAGNI)

- Backend, účty, história objednávok, export, párovanie prijatých platieb, viac jazykov.
- QR obrázky — odkaz stačí (kolegovia ho otvoria v Teamse). Ak bude treba, QR z payme URL je jedna malá knižnica
  (`qrcode-generator`) a jeden `<canvas>`.
- Import/parsovanie Boldu, DPH, tringelt, viac mien.

## Stav

Implementované a overené: logika (`node test.js` OK), formulár (smoke test v jsdom s Bolt objednávkou).
**Neoverené:** otvorenie odkazu v reálnej banke a inštalácia PWA na telefóne — treba vyskúšať.
