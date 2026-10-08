# Obed – rozpočet

Malá appka na rozpočítanie spoločnej objednávky obeda (Bolt Food a pod.) medzi kolegov.
Zadáte jedlá, kto čo zjedol a koľko ste zaplatili celkom. Appka spočíta, koľko má kto poslať,
a pre každého vygeneruje [payme.sk](https://www.payme.sk/pre-vyvojarov) odkaz a text do chatu.

**Appka:** <https://robkrzn.github.io/obed-rozpocet/> (dá sa pridať na plochu telefónu ako PWA)

## Ako to funguje

- **Jedlá:** názov, počet kusov a celková suma za všetky kusy.
- **Stravníci:** predvolene jeden na každý kus jedla; dajú sa premenovať a upraviť.
- **Zľava:** po zaplatení Bolt ukazuje pôvodné ceny a zľavu zvlášť — zadajte pôvodné ceny a celkovú zľavu,
  appka ju rozdelí medzi jedlá.
- **Doprava a poplatky:** zadáte zaplatenú sumu celkom (alebo extra náklady) a rozdelia sa rovnako medzi všetkých.
- **Výstup:** suma a odkaz na platbu pre každého, plus text na skopírovanie do Teamsu.

Všetky sumy sa počítajú v celých centoch a súčet podielov vždy sedí presne na zaplatenú sumu.

## Súkromie

Meno príjemcu a IBAN sa zadávajú v appke a ostávajú len v `localStorage` vášho zariadenia.
V repozitári ani na serveri nie sú žiadne osobné údaje.

## Vývoj

Žiadny build ani závislosti. Stačí otvoriť `index.html`, alebo spustiť testy (Node 18+):

```
node test/calc.test.js
```

```
index.html, manifest.json, sw.js   appka a PWA (v koreni, aby service worker pokryl celú appku)
src/calc.js                        čistá logika bez DOM: centy, rozdelenie, IBAN, payme odkaz
icons/                             ikony PWA
test/calc.test.js                  testy logiky
CLAUDE.md                          rozhodnutia a pravidlá projektu
```

Nasadenie: GitHub Pages z vetvy `main`, koreň repozitára. Po pushnutí sa PWA aktualizuje samo.
