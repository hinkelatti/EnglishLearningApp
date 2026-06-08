# Refactor terv – részletes, fázisokra bontva

> **Alapelv:** minden fázis után az app **fut és deploy-olható**. Egy fázis = egy git commit (vagy
> kis PR). Bármelyik fázis után meg lehet állni anélkül, hogy az app törött állapotban maradna.
> Minden fázis végén → [smoke-teszt-checklist.md](smoke-teszt-checklist.md).

## Cél-struktúra (a refactor végállapota)

```
EnglishLearningApp/
├── index.html                  # belépő váz: <head> + <link>-ek + <body> markup + <script type=module>
├── wrangler.toml
├── planning/                   # ez a könyvtár
└── assets/
    ├── css/
    │   ├── tokens.css          # :root változók, reset, alap tipográfia
    │   ├── base.css            # gombok, form-elemek, közös utility osztályok
    │   ├── layout.css          # header, nav, dropdown, main, sub-tabs
    │   ├── components.css      # kártyák, modal, chip, badge, toast, loading, err/ok
    │   └── panels/
    │       ├── translate.css   # fordítás / írás / üzleti / szövegértés / analyzer
    │       ├── roadmap.css     # roadmap, haladás, heti napló, hibaminták, szótár-dashboard, docs
    │       ├── oxford.css      # oxford szótár, bulk, import/export, anki, kifejezések
    │       ├── convo.css       # társalgás
    │       └── tenses.css      # igeidők, mondatszerkesztő, nyelvtan-referencia
    └── js/
        ├── main.js             # belépő modul: import-ok, init, window.onload, billentyűk
        ├── core/
        │   ├── api.js          # claude(), apiKey, saveKey/changeKey, safeParseJSON
        │   ├── state.js        # globális állapot + localStorage helperek (saveCards, oxSave…)
        │   ├── dom.js          # show/hide/dis, showToast, escapeAttr, normalise
        │   └── nav.js          # showMain/showSub/showOxTab/showTenseTab, dropdown, launchApp
        ├── data/
        │   ├── roadmap.js          # ROADMAP
        │   ├── tenses.js           # TENSES
        │   ├── grammar-exercises.js# GRAMMAR_EXERCISES
        │   ├── convo-topics.js     # CONVO_TOPICS
        │   ├── weekly-questions.js # WEEKLY_QUESTIONS
        │   └── doc-defaults.js     # DOC_DEFAULTS
        └── panels/
            ├── translate.js    # doTranslate, doGenCards, doGrammar, doGenText, doCheck, comp*, analyze*, writing*, uzleti*
            ├── roadmap.js      # renderRoadmap, progress, weekly log, error patterns, vocab dashboard, daily plan, docs
            ├── oxford.js       # oxLoad/Save, renderOx*, bulk*, *XLSX, anki*, phrase*
            ├── convo.js        # convo*, speech recognition + TTS
            ├── tenses.js       # tenseOnly*, builder*, renderGrReference, gyakorló-motor
            └── tutor.js        # tutorSend, tutorGetReply
```

> A panel-fájlok később tovább bonthatók (pl. `translate.js` → `writing.js` + `comprehension.js`),
> de **az első körben a fenti, durvább felbontás a cél** – kevesebb mozgatás, kisebb kockázat.

---

## Fázis 0 – Előkészítés és biztonsági háló

**Cél:** legyen visszaút és legyen mihez hasonlítani. Kód még nem mozdul.

**Lépések:**
1. Git: új ág a munkának: `git checkout -b refactor/modularization`.
2. **Baseline smoke teszt:** futtasd végig a [smoke-teszt-checklist.md](smoke-teszt-checklist.md)-t a
   *jelenlegi* fájlon, és jegyezd fel, mi működik. Ez lesz az összehasonlítási alap (nincs
   automata teszt, ezért ez a háló).
3. **Lokális dev szerver beállítása** (a moduláris fázisokhoz kell, mert `file://`-ról az ES module
   nem tölt be). Egy opció elég:
   - `npx serve .`  (Node), vagy
   - `python -m http.server 8080`, vagy
   - VS Code „Live Server” bővítmény.
4. **Az `index.html` duplikáció kezelése – döntés rögzítése:** mostantól az **`index.html` a
   kanonikus belépő** (ezt szolgálja a Cloudflare). Az `EnglishLearningApp.html`-t a refactor
   végén töröljük vagy átirányítóvá tesszük (lásd Fázis 6). A köztes fázisokban **csak az
   `index.html`-en dolgozunk**, hogy ne kelljen két fájlt szinkronban tartani.

**Kockázat:** nincs. **Elfogadás:** dev szerveren megnyitva az `index.html` ugyanúgy működik, mint
fájlból; baseline checklist kitöltve.

---

## Fázis 1 – CSS kiszervezése + deduplikáció

**Cél:** a `<style>` blokk (8–874. sor) külön fájlokba, `<link>`-kel hivatkozva. A működés
vizuálisan **nem változik**.

**Miért előbb, mint a JS?** A CSS kiszervezés a legkisebb kockázat: nincs benne logika, és a
`<link rel="stylesheet">` `file://`-ról is működik (nem kell hozzá module/szerver).

**Lépések:**
1. A `<style>` tartalmának tematikus szétvágása a cél-struktúra szerinti CSS fájlokba
   (`tokens` → `base` → `layout` → `components` → `panels/*`).
2. A `<style>...</style>` helyére `<link>` sorok a `<head>`-ben, a fenti betöltési sorrendben
   (a sorrend számít a kaszkád miatt!).
3. **Deduplikáció menet közben** – ütköző/ismételt szabályok feloldása. Ismert duplikátumok:
   - `.ref-card-body` (kétszer, eltérő értékkel: 218. és 280. sor körül)
   - `.corr-item` / `.corr-wrong` / `.corr-right` / `.corr-exp` (204–207 és 395–400 körül)
   - `.convo-correction-title`, `.convo-header`, `.convo-mic-btn`, `.convo-input-wrap` (több helyen)
   - `.ox-table td`/`th` (322–325 és 349–350)
   - `.tense-group` (228, 508)
   - Több `@media (max-width:600px)` blokk → összevonható.

   > ⚠️ Az ismétlődő szabályoknál **a fájl sorrendjében később jövő nyer**. Dedup közben ellenőrizd,
   > melyik érték az „élő”, és azt tartsd meg. Itt csúszhat be vizuális regresszió → figyeld a
   > smoke tesztnél.

**Kockázat:** alacsony–közepes (a dedup hozhat apró vizuális eltérést).
**Elfogadás:** az app vizuálisan változatlan minden panelen; checklist zöld.

---

## Fázis 2 – Statikus adatok kiszervezése

**Cél:** a tisztán adat jellegű, nagy tömbök külön `data/*.js` fájlokba. Ez „könnyű” kiszervezés,
mert nincs bennük logika.

**Érintett blokkok a `<script>`-ben:**
| Adat | Hely (kb.) |
|---|---|
| `ROADMAP` | 1729–2073 |
| `TENSES` | 2074–2152 |
| `GRAMMAR_EXERCISES` | 2153–2628 |
| `CONVO_TOPICS` | 2629–2640 |
| `DOC_DEFAULTS` | 2672–2729 |
| `WEEKLY_QUESTIONS` | 3357–3363 |

**Lépés (két változat a választott úttól függően – lásd Fázis 3 döntés):**
- **Ha build nélküli ESM:** mindegyik adat `export const ROADMAP = [...]`, és a felhasználó
  modul `import`-tal kéri. **DE** ehhez már module-ban kell lennünk → ezt a fázist gyakorlatban
  a 3. fázis ELSŐ részeként érdemes csinálni (amint `type="module"`-ra váltunk).
- **Ha még klasszikus script (átmeneti):** külön `<script src="assets/js/data/roadmap.js">` fájlok,
  bennük sima `var ROADMAP = [...]` (globális). Így a 3. fázis előtt is kiszervezhető, module nélkül.

> **Ajánlás:** ha a 3. fázisban build nélküli ESM-et választunk (lásd lent), akkor a 2. fázist
> olvaszd be a 3. fázis elejébe, és rögtön `export`-tal csináld. Ha viszont a CSS után azonnal
> szeretnél egy „könnyű győzelmet” module-váltás nélkül, a klasszikus `<script src>` változat is jó.

**Kockázat:** alacsony. **Elfogadás:** roadmap, igeidő-gyakorlók, társalgási témák, dokumentum-
sablonok, heti kérdések mind betöltenek és működnek.

---

## Fázis 3 – JavaScript modularizálás (a fő munka)

### Döntési pont: build nélküli ESM vs. bundler

| | **A) Build nélküli ES module** *(ajánlott)* | **B) Bundler (Vite)** |
|---|---|---|
| Deployment | Változatlan (statikus fájlok) | Kell `npm run build`, Cloudflare build-config |
| Toolchain | Nincs (csak dev szerver) | Node + npm + node_modules |
| Inline handlerek | `window.fn = fn` szükséges | Ugyanúgy, vagy Vite-tal kezelve |
| Minify/bundle | Nincs (több HTTP kérés) | Van (1 optimalizált bundle) |
| Kockázat / komplexitás | Alacsony | Közepes |

**Ajánlás: A) build nélküli ESM.** A jelenlegi deployment (Cloudflare statikus) így érintetlen
marad, és a OneDrive-os munkakönyvtárba nem kerül `node_modules`. A Vite legyen külön, opcionális
fázis (Fázis 7), ha a bundle-méret/minify később fontossá válik.

### A 171 inline handler stratégiája

A `<body>`-ban 171 darab `onclick="doX()"` / `onchange="..."` van. Module-ban a függvények nem
globálisak. Két lehetőség:

- **A1) Áthidalás (ajánlott, gyors):** minden inline handler által hívott függvényt kiteszünk a
  `window`-ra. Konvenció: minden panel-modul a végén:
  ```js
  Object.assign(window, { doTranslate, doGenCards, toggleWord /* ...a HTML-ből hívottak */ });
  ```
  Így a 171 inline handler **érintetlen marad**, az app azonnal működik module-ként is.
- **A2) Teljes tisztítás (lassabb, később):** az inline handlereket `addEventListener` +
  `data-*` attribútumok / event-delegation váltja. Tisztább végállapot, de 171 hely átírása.
  → Ezt **a refactor után, opcionálisan, panelenként** érdemes (Fázis 8), nem most.

> **Most az A1-et használjuk**, hogy a modularizálás kockázata minimális legyen.

### Sorrend a 3. fázison belül (infrastruktúra → adat → panelek)

A `<script>` egyetlen `<script type="module" src="assets/js/main.js">`-re cserélődik; a `main.js`
importálja a többit. A kiszervezés sorrendje a függőségek szerint:

**3.1 – Infrastruktúra (core):**
- `core/api.js`: `claude()` (3635), `apiKey`, `saveKey` (3660), `changeKey` (3676),
  `safeParseJSON` (3603).
- `core/dom.js`: `show`/`hide`/`dis` (3599–3601), `showToast` (4967), `escapeAttr` (5111),
  `normalise` (5141).
- `core/state.js`: a szétszórt globális `var`-ok egy helyre (2641–2672, 2824–2828, 4021–4023,
  4158, 4250–4252, 4270, stb.) + localStorage helperek.
- `core/nav.js`: `launchApp` (3676), `showMain` (3734), `showSub` (3747), `showOxTab` (3773),
  `showTenseTab` (3783), `toggleDropdown`/`closeDropdowns` (3723–3727).

**3.2 – Adatmodulok** (Fázis 2 tartalma, most `export`-tal): `data/*.js`.

**3.3 – Panelek egyenként** (minden panel külön commit + smoke teszt):
1. `panels/translate.js` – fordítás, kártyagen, nyelvtan, szövegértés, analyzer, írás, üzleti
   (kb. 3797–4157, 4463–4796).
2. `panels/tutor.js` – tanulási asszisztens (4158–4249).
3. `panels/tenses.js` – igeidő-gyakorlók (2824–3033), mondatszerkesztő (4250–4462),
   nyelvtan-referencia + gyakorló-motor (3034–3216, 4797–5307).
4. `panels/roadmap.js` – haladás, heti napló, hibaminták, szótár-dashboard, napi terv, docs
   (2730–2767, 3217–3598).
5. `panels/oxford.js` – oxford szótár, bulk gen, XLSX import/export, anki sync, kifejezések
   (5308? és 5499–6110 nagy része).
6. `panels/convo.js` – társalgás, beszédfelismerés, TTS (5308–5498).

**3.4 – `main.js` (belépő):**
- import-ok, `window.onload` (3710) init logika, globális billentyű-listenerek (3684, 4239),
  globális `click` listener a dropdown-zárásra (3705).

**Kockázat:** közepes–magas (ez a nagy lépés). Mérséklés: panelenként haladni, minden panel után
smoke teszt, és A1 áthidalással a HTML-t nem bántani.
**Elfogadás:** minden panel ugyanúgy működik, mint a baseline; a böngésző konzol hibamentes.

---

## Fázis 4 – Tisztítás és deduplikáció (JS)

**Cél:** a modularizálás közben felszínre kerülő szemét eltakarítása.

**Konkrét teendők:**
1. **Duplikált függvénydefiníciók megszüntetése** (jelenleg kétszer definiálva, a második felülírja
   az elsőt):
   - `saveCards` (6038 és 6084)
   - `updateCounters` (6059 és 6086)
   - `oxSaveSnapshot` (6067 és 6094)
   - `getWeekNumber` (6076 és 6103)

   > Ellenőrizd, a két verzió azonos-e. Ha eltér, a **6084 utáni (későbbi)** az élő → azt tartsd meg.
2. **Globális állapot konszolidálása** a `core/state.js`-be; a szétszórt `var`-ok megszüntetése.
3. **Holt kód** és nem használt változók eltávolítása (a duplikátumok kiderülése után).
4. **Névkonvenciók** egységesítése (a kód `camelCase`-t használ, de vannak `var`-ok mindenhol →
   ahol biztonságos, `const`/`let`).

**Kockázat:** alacsony–közepes. **Elfogadás:** funkcionálisan változatlan, konzol tiszta.

---

## Fázis 5 – Deployment frissítés és a duplikált HTML megszüntetése

**Cél:** a Cloudflare Pages deployment a moduláris struktúrával is működjön, és szűnjön meg az
`index.html` ↔ `EnglishLearningApp.html` kézi szinkron.

**Lépések:**
1. `wrangler.toml` ellenőrzése – `[assets] directory = "."` mellett az `assets/` mappa kiszolgálása
   automatikus, de **ellenőrizni kell**, hogy a relatív útvonalak (`assets/js/main.js`) helyesek
   lokálisan ÉS a Cloudflare URL-en is.
2. **`EnglishLearningApp.html` sorsa:** mivel `index.html` a belépő, az `EnglishLearningApp.html`
   vagy (a) törölhető, vagy (b) egy 1 soros `<meta http-equiv="refresh">` átirányítóvá alakul az
   `index.html`-re (ha külső link mutat rá). **Ajánlott: törlés**, ha senki nem hivatkozik rá.
3. Cloudflare preview deploy → teszt éles URL-en (a Web Speech API és AnkiConnect localhost-os
   viselkedését is nézd, mert ezek környezetfüggők).

**Kockázat:** közepes (deployment-specifikus). **Elfogadás:** a Cloudflare preview URL-en minden
panel működik; nincs 404 az `assets/`-re.

---

## Fázis 6 – (Opcionális) Bundler bevezetése: Vite

**Csak ha** a sok kis HTTP kérés vagy a minify hiánya zavaró lesz.

**Lépések:** `npm create vite`, a meglévő `assets/` belépőként, `vite build` → `dist/`, és a
Cloudflare build parancs/kimeneti könyvtár beállítása. A `wrangler.toml` `directory`-ja `dist`-re vált.

**Kockázat:** közepes (új toolchain). **Megjegyzés:** ez **visszafordítható** és független a többi
fázistól – nyugodtan kihagyható.

---

## Fázis 7 – (Opcionális) Inline handlerek lecserélése `addEventListener`-re

A Fázis 3 A1 áthidalás (`window.fn = fn`) tiszta végállapotra cserélése: panelenként az inline
`onclick`/`onchange` → `addEventListener` + event delegation. 171 hely, ezért **panelenként,
ráérősen**. Megszünteti a `window`-szennyezést.

---

## Összefoglaló: fázisok és kockázat

| Fázis | Tartalom | Kockázat | Megállhatok utána? |
|---|---|---|---|
| 0 | Előkészítés, baseline, dev szerver | nincs | – |
| 1 | CSS kiszervezés + dedup | alacsony–közepes | ✅ |
| 2 | Statikus adat kiszervezés | alacsony | ✅ |
| 3 | JS modularizálás (core → adat → panelek) | közepes–magas | ✅ (panelenként) |
| 4 | JS tisztítás, dup-függvények | alacsony–közepes | ✅ |
| 5 | Deployment + HTML-dup megszüntetés | közepes | ✅ |
| 6 | *(opc.)* Vite bundler | közepes | ✅ |
| 7 | *(opc.)* inline handler → addEventListener | közepes | ✅ |

**Minimális értelmes cél:** Fázis 0–4 (moduláris, tiszta kód, build nélkül).
**Teljes cél:** + Fázis 5 (deployment rendezve). A 6–7 ízlés szerint.
