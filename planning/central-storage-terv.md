# Központi tárolás terv — localStorage → Cloudflare D1 szinkron

> **Cél:** a jelenlegi `localStorage`-alapú tárolást egy központi, eszközök közt szinkronizált
> tárral kiegészíteni, hogy az egyik eszközön történt változás a többin is megjelenjen.
> **Másodlagos nyereség:** az Anthropic API-kulcs lekerül a böngészőből (szerver-oldali secret).
>
> **Rögzített döntések (2026-06-08):**
> - **Felhasználó:** egyetlen (személyes), több eszköz → nincs user-tábla, nincs regisztráció.
> - **Backend:** Cloudflare **D1** (SQLite), **Pages Functions** formában (nem külön Worker).
> - **Auth:** egyetlen véletlen `SYNC_TOKEN` (auth + azonosító egyben), `Bearer` headerben.
> - **Frontend marad build nélküli statikus** — a `functions/` mappa különálló szerver-oldal.

---

## Miért Pages Functions (és nem külön Worker)?

Az app már Cloudflare **Pages**-en fut. A `functions/` mappa a repo gyökerében automatikusan
Workerként fut **ugyanarról a domainről**:
- **Nincs CORS** (azonos origin a frontenddel),
- **ugyanaz a `git push` = ugyanaz a deploy** (nincs külön `wrangler deploy`),
- a D1-binding és a secret-ek a `wrangler.toml`-ban / a Cloudflare dashboardon állnak.

A statikus HTML/CSS/JS deploy változatlan; csak megjelenik mellette a `functions/` mappa.

---

## Cél-struktúra

```
EnglishLearningApp/
├── index.html              # változatlan, build nélkül
├── assets/                 # változatlan (app.js itt módosul: claude() + Store réteg)
├── functions/              # ÚJ — Pages Functions (szerver-oldal)
│   └── api/
│       ├── store.js        # GET (összes kulcs) + PUT (egy kulcs)
│       └── claude.js       # Claude API proxy
├── schema.sql              # ÚJ — D1 séma (egyszeri inicializáláshoz)
└── wrangler.toml           # + [[d1_databases]] binding
```

---

## Adatmodell (egy felhasználó → nincs user_id)

`schema.sql`:
```sql
CREATE TABLE IF NOT EXISTS store (
  key        TEXT PRIMARY KEY,   -- 'anki_cards', 'oxford_words', 'doc_profile', ...
  value      TEXT NOT NULL,      -- a JSON string, ahogy most is a localStorage-ban
  updated_at INTEGER NOT NULL    -- ms epoch, last-write-wins konfliktusfeloldáshoz
);
```

A kliensoldali `JSON.stringify(...)` érték **változatlanul** a `value` mezőbe kerül — a meglévő
adatszerkezeten nem kell változtatni.

### Tárolt kulcsok (a mostani localStorage-ból)

| Kulcs | Típus | Szinkron |
|---|---|---|
| `anki_cards` | tömb | ✅ |
| `oxford_words` | tömb | ✅ |
| `oxford_phrases` | tömb | ✅ |
| `ox_snapshots` | tömb | ✅ |
| `gr_statuses` | objektum | ✅ |
| `error_patterns` | tömb | ✅ |
| `weekly_sessions` | tömb | ✅ |
| `weekly_logs` | tömb | ✅ |
| `ex_history` | tömb | ✅ |
| `daily_tasks_<dátum>` | tömb | ✅ (dinamikus kulcs) |
| `doc_<név>` | string | ✅ (dinamikus kulcs) |
| `ex_cache_<id>` | tömb | ⚪ opcionális (újragenerálható cache) |
| `anthropic_api_key` | string | ⛔ megszűnik (helyette szerver-oldali secret) |

---

## Titkok (Cloudflare secret — sosem a kliensen)

| Secret | Mire való |
|---|---|
| `ANTHROPIC_API_KEY` | a `/api/claude` proxy ezzel hívja a Claude-ot |
| `SYNC_TOKEN` | a kliens `Authorization: Bearer …` headerben küldi minden hívásnál |

Beállítás (a felhasználó keze kell hozzá):
```
npx wrangler pages secret put ANTHROPIC_API_KEY
npx wrangler pages secret put SYNC_TOKEN
```

---

## Végpontok (mind a `SYNC_TOKEN` mögött)

| Végpont | Metódus | Mit csinál |
|---|---|---|
| `/api/store` | `GET` | összes kulcs lehúzása (`[{key, value, updated_at}]`) — induláskor / `focus`-ra |
| `/api/store` | `PUT` | egy kulcs mentése `{key, value, updated_at}` (debounce-olt write-through) |
| `/api/claude` | `POST` | a mostani `claude()` hívás szerver-oldali proxyja |

Minden végpont a `Authorization: Bearer <SYNC_TOKEN>` headert ellenőrzi; hiányában `401`.

---

## Kliensoldali változások

1. **`claude()` átirányítása** ([assets/js/app.js:940](../assets/js/app.js:940)):
   `https://api.anthropic.com/v1/messages` helyett a saját `/api/claude` végpont.
   Az `anthropic-dangerous-direct-browser-access` header és az `x-api-key` **eltűnik**;
   helyette `Authorization: Bearer <SYNC_TOKEN>`.

2. **Belépő-képernyő átértelmezése** ([assets/js/app.js:965](../assets/js/app.js:965), `saveKey`/`window.onload`):
   a mostani „API kulcs” mező helyett a **`SYNC_TOKEN`-t** kéri (UX szinte azonos), és
   `localStorage`-ban tárolja (ez az egy kulcs maradhat lokálisan, mert ez a hozzáférés alapja).

3. **Vékony `Store` réteg** a ~30 `localStorage`-hívás köré (lásd grep az app.js-ben):
   ```js
   var Store = {
     get(key, fallback){ /* localStorage-ból olvas (offline cache) */ },
     set(key, val){ /* localStorage + debounce-olt PUT /api/store */ }
   };
   ```
   A `localStorage` **megmarad offline cache-nek**; a D1 a forrás. A `setItem`/`getItem` hívások
   fokozatosan `Store.set`/`Store.get`-re cserélődnek.

4. **Pull on load + merge**: app induláskor `GET /api/store`, majd `updated_at` szerint a frissebb
   verzió nyer (last-write-wins). Opcionálisan `window.focus`-ra is egy pull.

---

## Megvalósítási fázisok (mindegyik külön commit + deploy)

> ⚠️ Minden `git push` = éles Cloudflare deploy. Push előtt jelzem, mit deployolok.

### CS-1 — D1 + binding + séma *(infrastruktúra)*
- `npx wrangler d1 create englishlearningapp-db`
- `wrangler.toml` kiegészítése `[[d1_databases]]` bindinggel (`DB`).
- `schema.sql` létrehozása + `npx wrangler d1 execute … --file schema.sql`.
- **Felhasználói kéz kell:** a `wrangler d1 create` után a kiírt `database_id`-t be kell írni a
  `wrangler.toml`-ba; Cloudflare-fiók bejelentkezés (`wrangler login`).
- **Elfogadás:** a tábla létezik (`wrangler d1 execute … "SELECT name FROM sqlite_master"`).

### CS-2 — `/api/claude` proxy + `claude()` átirányítása *(azonnali biztonsági nyereség)*
- `functions/api/claude.js`: Bearer-ellenőrzés → továbbítás az Anthropic API-ra a szerver-oldali
  `ANTHROPIC_API_KEY`-vel.
- Kliens `claude()` átírása a `/api/claude` végpontra; a belépő mező `SYNC_TOKEN`-re vált.
- **Felhasználói kéz kell:** `ANTHROPIC_API_KEY` és `SYNC_TOKEN` secret beállítása.
- **Elfogadás:** a fordítás/kártyagen működik a proxyn át; a böngészőben **nincs** API-kulcs.
- **Megáll-e itt?** ✅ — ez önállóan is teljes értékű (kulcs lekerült a kliensről), szinkron nélkül is.

### CS-3 — `/api/store` GET + PUT *(backend tár kész)*
- `functions/api/store.js`: Bearer-ellenőrzés; `GET` = összes sor, `PUT` = upsert `updated_at`-tel.
- **Elfogadás:** `curl`-lel/DevTools-ból egy kulcs PUT-olható és visszaolvasható.

### CS-4 — Kliens `Store` réteg + write-through *(szinkron írás él)*
- `Store` wrapper bevezetése; a `localStorage.setItem/getItem` hívások átvezetése.
- Debounce (pl. 1–2 mp), hogy a gyors egymás utáni mentések egy PUT-ba csússzanak.
- **Elfogadás:** egy mentés után a D1-ben megjelenik a frissített érték.

### CS-5 — Pull on load + első migráció *(több eszköz összeér)*
- Induláskor `GET /api/store` → `updated_at` szerinti merge a lokális cache-be.
- **Első migráció:** ha a szerver üres, a meglévő localStorage feltöltése a D1-be.
- **Elfogadás:** A eszközön mentett változás B eszközön (reload/focus után) megjelenik.

---

## Összefoglaló: fázisok és kockázat

| Fázis | Tartalom | Kockázat | Megállhatok utána? |
|---|---|---|---|
| CS-1 | D1 + binding + séma | alacsony | – (önállóan nincs hatása) |
| CS-2 | Claude-proxy + kulcs lekerül a kliensről | közepes | ✅ (önállóan értékes) |
| CS-3 | `/api/store` végpontok | alacsony | ✅ |
| CS-4 | Kliens `Store` réteg, write-through | közepes | ✅ |
| CS-5 | Pull + migráció (szinkron él) | közepes | ✅ (teljes cél) |

**Minimális értelmes cél:** CS-1 + CS-2 (kulcs lekerül a böngészőből).
**Teljes cél:** + CS-3..CS-5 (eszközök közti szinkron).

---

## Kockázatok és megjegyzések

- **Secret-ek a felhasználó kezén:** a `wrangler pages secret put` és a `d1 create` interaktív,
  Cloudflare-fiók kell hozzá — ezeket a felhasználó futtatja (én előkészítem a parancsokat).
- **Konkurens írás:** személyes használatnál ritka; last-write-wins (`updated_at`) elég. Nincs
  szükség valódi merge-re vagy CRDT-re.
- **Offline:** a localStorage cache miatt az app offline is működik; visszacsatlakozáskor a következő
  `Store.set` szinkronizál (egyszerű modell, nem teljes offline-first queue).
- **Költség:** D1 ingyenes tier (5 GB, napi több M sor-művelet) személyes használatra bőven elég.
- **Cache kulcsok (`ex_cache_*`):** alapból NEM szinkronizáljuk (újragenerálható); ha mégis kell,
  később hozzávehető.
```
