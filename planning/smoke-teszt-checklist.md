# Smoke teszt checklist

Nincs automata teszt, ezért **ez a biztonsági háló**. Futtasd végig:
- a refactor **kezdete előtt** (baseline – jelöld, mi működik már most), és
- **minden fázis után**.

Böngésző **konzol** legyen nyitva (F12) → a végén **0 hiba** legyen. ES module fázisoktól kezdve
**dev szerverről** nyisd (`npx serve` / Live Server), ne `file://`-ról.

## 0. Belépés / infra
- [ ] Oldal betölt, az API-kulcs képernyő megjelenik
- [ ] API-kulcs megadása → app betölt (`launchApp`)
- [ ] Kulcs `localStorage`-ben megmarad (frissítés után nem kér újra)
- [ ] „Kulcs csere” gomb működik
- [ ] Fejléc kártyaszámláló látszik
- [ ] Konzol hibamentes

## 1. Navigáció
- [ ] Mind az 5 fő panel váltható (Fordítás, Roadmap, Oxford, Társalgás, Igeidők)
- [ ] Nav dropdown(ok) nyílnak/záródnak, kívülre kattintva bezárnak
- [ ] Aktív panel/menü vizuálisan kiemelt
- [ ] Sub-tab váltás minden panelen belül működik

## 2. Fordítás panel
- [ ] **Szöveg fordítás**: bevitt szöveg → fordítás (Claude hívás) megjelenik
- [ ] Szóra kattintás → kijelölés (chip), eltávolítás chipről
- [ ] Kijelölt szavakból kártyagenerálás
- [ ] **Nyelvtan** elemzés fut
- [ ] **Írás** feladat generálás + ellenőrzés
- [ ] **Üzleti** feladat generálás + ellenőrzés (típus/hangnem váltók)
- [ ] **Szövegértés**: szöveg + kérdések generálás, válasz ellenőrzés
- [ ] **Analyzer**: nyelv auto-detektálás, igeidő-elemzés

## 3. Roadmap panel
- [ ] **Áttekintés**: haladási sáv, donut, statisztikák megjelennek
- [ ] **Napi terv** generálás, feladat kipipálás
- [ ] **Szótár dashboard** számai helyesek
- [ ] **Térkép (map)**: roadmap kártyák, modal nyílik, státusz állítható (todo/learning/done)
- [ ] **Heti napló**: kérdéssor végigvihető, mentés, korábbi bejegyzés látszik
- [ ] **Hibaminták** lista renderel
- [ ] **Dokumentumok**: fülváltás, mentés, export

## 4. Oxford szótár panel
- [ ] Dashboard (donutok/szintsávok) renderel
- [ ] Szólista lapozható, státusz select váltható
- [ ] **XLSX import** (szavak ÉS kifejezések) – fájl betölt, CDN XLSX lazy-load működik
- [ ] CSV export
- [ ] **Anki**: teszt kapcsolat, szinkron (ha fut az AnkiConnect localhoston)
- [ ] Bulk kártyagenerálás indul/leáll
- [ ] Kifejezések (phrases) lista + bulk

## 5. Társalgás panel
- [ ] Téma + szint kiválasztás, beszélgetés indul
- [ ] Üzenet küldés → Claude válasz, hibajavítás megjelenik
- [ ] Mikrofon (Web Speech) – ha támogatott a böngésző
- [ ] TTS felolvasás kapcsoló
- [ ] Összefoglaló a végén

## 6. Igeidők panel
- [ ] Igeidő-választó (csak igeidő gyakorló) – kijelölés, mind/egyik sem
- [ ] Gyakorlás indul, válasz ellenőrzés, pontszám, következő, összegzés
- [ ] **Mondatszerkesztő**: feladat generál, ellenőrzés, megoldás
- [ ] **Nyelvtan-referencia**: lista szűrhető, kártya kinyílik

## 7. Tanulási asszisztens (tutor)
- [ ] Üzenet küldés → válasz buborék jön

## 8. Reszponzivitás (gyors pillantás)
- [ ] Mobil nézet (≤600px): nav scrollozható, gridek 1 oszlopra esnek, nincs vízszintes túlcsordulás

---

### Megjegyzés a környezetfüggő funkciókhoz
- **Web Speech (mikrofon/TTS)**: csak HTTPS / `localhost` alatt és támogatott böngészőben.
- **AnkiConnect**: csak ha az Anki fut a gépen a plugin-nel (localhost:8765).
- **XLSX**: a `cdnjs`-ről töltődik első import-kor → internet kell hozzá.

Ezeket ha a baseline-nál sem tudtad tesztelni, jelöld „N/A”-nak, hogy a fázisok után se ess pánikba.
