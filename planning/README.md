# Refactor terv – Angol Tanuló app

Ez a könyvtár az `EnglishLearningApp.html` (egyetlen, ~5550 soros monolit fájl) strukturális
átalakításának tervét tartalmazza.

## Fájlok

| Fájl | Tartalom |
|---|---|
| [refactor-terv.md](refactor-terv.md) | A teljes, fázisokra bontott terv (a fő dokumentum) |
| [smoke-teszt-checklist.md](smoke-teszt-checklist.md) | Manuális tesztlista – minden fázis után ezt kell végigfuttatni |

## Vezetői összefoglaló

A fájl jelenleg **minden** elemet (CSS + HTML + JS) egyben tartalmaz:

| Rész | Sorok | Arány |
|---|---|---|
| CSS (`<style>`) | 8–874 | ~16% |
| HTML (`<body>`) | 876–1723 | ~15% |
| JavaScript (`<script>`) | 1724–6111 | ~69% |

A cél: szétbontani logikus, külön fájlokba úgy, hogy **az app minden fázis után működjön és
deploy-olható maradjon**. A megközelítés **inkrementális és visszafordítható**.

## A 3 legfontosabb tudnivaló (constraint)

1. **`index.html` = `EnglishLearningApp.html`** – bájtra azonos másolat. A Cloudflare Pages az
   `index.html`-t szolgálja ki (`wrangler.toml` → `[assets] directory = "."`). A két fájl kézi
   szinkronban tartása hibaforrás → a tervben ezt megszüntetjük.
2. **Nincs build lépés** – a Cloudflare statikus fájlokat szolgál ki. Ezért az elsődleges irány a
   **build nélküli, natív ES module** megoldás (`<script type="module">` + `<link>` CSS-hez).
   Ennek egyetlen ára: fejlesztés közben **HTTP szerver kell** (a böngésző `file://`-ról nem tölt
   be modulokat). Pl. `npx serve` vagy VS Code „Live Server”.
3. **171 inline eseménykezelő** (`onclick="..."`, `onchange="..."`). ES module-ban a függvények
   nem globálisak, ezért minden inline handler által hívott függvényt **explicit ki kell tenni a
   `window`-ra** (vagy később `addEventListener`-re cserélni). Ez a modularizálás fő kockázata.

## Döntési pont

A 3. fázisnál (JS modularizálás) két út van. **Ajánlott: build nélküli ES module** – egyszerű,
a deployment változatlan marad. A bundler (Vite) opcionális, későbbi lépés. Részletek a fő tervben.
