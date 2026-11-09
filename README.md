# MyAttendance

Staff attendance for the **DAICOE AI Center, Kota Kinabalu High School**. Staff clock in and out with the **MyAttendance phone app**, which records the GPS position and checks it against the DAICOE zone. Admins use the **website**. The time always comes from the server, not the phone. Records print on the LPS form *Rekod Kedatangan Pekerja Lembaga Pengurusan Sekolah Tinggi Kota Kinabalu*.

**Phone app (staff, Android)**
- **Clock:** location status, latitude/longitude, a live map with the DAICOE zone, a big Clock in / Clock out button, and today's card (working hours, Zone Status, clock-in, clock-out, hours worked), laid out like the UMS Go attendance screen.
- Inside the zone counts as **Internal**. Outside it counts as **External**, and the person types a reason, e.g. a course at another school. The admin can block External clock-ins instead.
- Positions from fake-GPS (mock location) apps are refused.
- **History** by month, with late, left early, External and corrected days flagged. Tap a day for the exact times, GPS positions and what prints in *Perkara Khas*.
- **Requests:** annual leave, MC, course, official duty outside, time correction, other.
- **Print:** the LPS form for this month, last month or any dates. Print it, save it as a PDF, or share the PDF (WhatsApp, email, Drive).
- **Profile:** a signature drawn with a finger (for the T. Tangan column) and a password change.

**Website (admins only)**
- **Today:** who is in, out, late, External or away, and a map of where each person clocked in.
- **Staff:** add staff (each gets a temporary password), assign working hours, reset passwords, switch accounts off.
- **Records:** every clock-in and clock-out with its GPS position. You can edit or add records, but only with a reason, and every change goes to the audit log. Records flag a **shared device** when one phone clocked in for two people on the same day. Export to Excel (CSV).
- **Requests:** approve or reject. Approved leave and duty fill *Perkara Khas*. An approved time correction updates the record.
- **Print:** the paper form, auto-filled. Two weeks per A4 landscape page, for one person or everyone, with or without signatures.
- **Settings:** the staff app download link, zones on a map ("use my current location"), what happens outside the zone, the GPS accuracy limit, working-hour slots (WP1/WP2/WP3), public holidays (Sabah 2026 included) and the form title.
- **Staff app page** (`/app`): a download button, a QR code and three install steps, for sharing with staff.

Staff who try to log in on the website are pointed to the app. If someone can't install it yet (for example an iPhone user), **Settings → Staff app → Also allow clocking in on the website** opens the website to staff again.

---

## 1. Try it on your computer

You need [Node.js 22 LTS](https://nodejs.org).

```bash
npm install
npm run dev
```

Open http://localhost:3000 and create the first admin account. With no `DATABASE_URL` set, the server uses a built-in database stored in the `.data` folder.

To see realistic data, go to **Admin → Settings → Demo data → Add demo staff**. This adds four demo staff (password `demo12345`) with five weeks of records. **Remove demo staff** deletes them again.

To try the phone app against this local server, see [Try the app without building it](#try-the-app-without-building-it-expo-go).

## 2. Put the website online

The phone app needs an **HTTPS** address to talk to. Pick **one** of these two options.

### Option A: Vercel + Supabase (recommended)

This works on any phone, on Wi-Fi or mobile data, with no VPN. The free tiers are enough for a small team.

1. **Supabase:** create a project (region *Southeast Asia (Singapore)*). Click **Connect** and copy the **Session pooler** connection string (port `5432`, host ending in `pooler.supabase.com`). Put your database password into it. Don't use the Transaction pooler (port `6543`): the database driver this server uses (postgres.js) sends several queries at once, which Supabase warns can hang or mix up rows in that mode.
2. **GitHub:** push this folder to a *private* repository.
3. **Vercel:** choose **Add New → Project** and import the repository. Under **Environment Variables**, add:
   - `DATABASE_URL`: the Supabase string from step 1
   - `AUTH_SECRET`: a random string of 32+ characters. You can make one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
4. Click **Deploy**. Open the `https://….vercel.app` address and create the admin account.

`vercel.json` runs the server in Singapore (`sin1`), next to the Supabase database, so every screen loads quickly from Kota Kinabalu. `.vercelignore` leaves the `mobile` folder out of the website build.

The server creates its own tables on first start. If you'd rather create them yourself, `db/schema.sql` can be pasted into the Supabase SQL editor.

### Option B: the Ubuntu server at school (Docker + Tailscale)

Staff phones need the Tailscale app, and the server must be booted into Ubuntu, not Windows, for clock-ins to work.

```bash
git clone <your repo> myattendance && cd myattendance
cp .env.example .env          # set POSTGRES_PASSWORD and AUTH_SECRET
docker compose up -d --build
sudo tailscale serve --bg 3000
```

The server is now at `https://<server-name>.<your-tailnet>.ts.net`. If you later want it reachable without Tailscale, use `tailscale funnel` instead of `serve`.

Back up the database:

```bash
docker compose exec db pg_dump -U myattendance myattendance > myattendance-$(date +%F).sql
```

## 3. Build the phone app (Android)

The app lives in the `mobile` folder (Expo / React Native). Expo's cloud service, **EAS Build**, turns it into an installable `.apk` file, so you don't need Android Studio. A free [Expo account](https://expo.dev/signup) is enough.

1. **Put your server address in the app** (optional, but staff then skip a setup screen). In `mobile/eas.json`, set `EXPO_PUBLIC_API_URL` under `preview` (and `production`) to your HTTPS address, for example `"https://myattendance.vercel.app"`. If you leave it empty, the app asks for the address the first time it opens.
2. **Build:**

   ```bash
   cd mobile
   npm install
   npm install -g eas-cli
   eas login
   npm run build:apk
   ```

   The first time, answer **Yes** when EAS offers to create the project and to generate an Android keystore. EAS keeps the keystore, so every later build installs over the old one. The build runs in the cloud and takes about 10 to 20 minutes. When it finishes, the terminal and the build page on expo.dev show a link to the `.apk`.
3. **Share it:** paste the `.apk` link into **Admin → Settings → Staff app → Android app download link** and save. If you'd rather keep the file yourself, upload it to Google Drive, share it as *Anyone with the link*, and paste that link instead. Staff open `https://<your server>/app` on their phone (or scan the QR code on that page) and tap **Download for Android**.

**Updating the app:** change `"version"` in `mobile/app.json` (for example to `1.0.1`), run `npm run build:apk` again (the build number goes up by itself), and replace the file or link. Staff install the new file over the old app and stay logged in.

**Google Play:** `npm run build:playstore` makes the `.aab` file Google Play needs. Publishing there needs a Google Play developer account.

### Try the app without building it (Expo Go)

1. Install **Expo Go** from Google Play on an Android phone.
2. On the computer: `cd mobile`, `npm install`, `npx expo start`. Scan the QR code with Expo Go. The phone must be on the same Wi-Fi as the computer (or run `npx expo start --tunnel`).
3. When the app asks for the server address, enter your online address, or `http://<your computer's IP>:3000` for the local server from step 1.

Expo Go is for testing. The installed `.apk` only connects to **https://** addresses.

### iPhone

The same code builds for iPhone with `eas build --platform ios`, but installing on iPhones needs an Apple Developer account (USD 99 a year). Until then, iPhone users can use the website: turn on **Settings → Staff app → Also allow clocking in on the website**. The website can't detect fake-GPS apps, so keep it off when nobody needs it.

## 4. First-day checklist (admin)

1. **Settings → Attendance zone:** stand inside the DAICOE AI Center, edit the zone and tap **Use my current location as the centre**. Set a radius that covers the building and car park (indoor GPS can be 20–50 m off), then save. The default zone is centred on the KKHS campus with a 200 m radius.
2. **Settings → Working hours:** check the slots (WP1 7:30–4:30, WP2 8:00–5:00, WP3 8:30–5:30, Mon–Fri) and pick the default for new staff. Add a grace period if a few minutes late shouldn't count.
3. **Settings → Public holidays:** Sabah's 2026 holidays are already included. Add 2027's once they are gazetted.
4. **Settings → Staff app:** paste the Android download link (section 3).
5. **Staff → Add staff** for each person. Use **Copy login details**: it copies the app link, the server address, the staff number and the temporary password, ready to send on WhatsApp.
6. Each person installs the app, logs in, chooses their own password, and allows location (**While using the app**, with **Precise** on).

## 5. How the rules work

| What | Rule |
| --- | --- |
| Time | Always the server's clock, in Malaysia time (UTC+8). Changing the phone's clock has no effect. |
| Location | Saved only at the moment someone clocks in or out. The app reads GPS only while its Clock screen is open; nothing runs in the background. |
| Internal / External | Inside any active zone is Internal. Outside, the person must give a reason (or is blocked, if the admin chose that). |
| Accuracy | Positions less accurate than the limit (default 1000 m) are refused, which stops rough network-based locations. |
| Fake GPS | The app refuses a position that Android marks as coming from a mock-location app, and the server checks the same flag. |
| Late | Clocking in after the slot's start time plus the grace period. Not counted on holidays, approved leave days or non-working days. |
| Left early | Clocking out before the slot's end time. |
| Perkara Khas | Filled from: public holiday, approved leave or duty, External reason, late or early minutes, a missing clock-out, an approved correction, an admin record or note, and absence. |
| Absent | A past working day with no record and no leave. Days before a person's account was created are left blank. |

No app can stop every trick (a rooted phone can hide a fake location), but the server time, the mock-location check, the shared-device flag, the audit log and the exact coordinates on every record make cheating easy to spot.

## 6. Printing

**Staff (app):** open **Print**, choose *This month*, *Last month*, a month or a date range, and whether to print your signature. **Print or save as PDF** opens the phone's print screen (pick a printer, or *Save as PDF*). **Share PDF** sends the file to WhatsApp, email or Drive.

**Admin (website):** **Admin → Print**, choose the person (or everyone), the period and signatures, then **Open print view → Print**. Choose **Save as PDF** to keep a copy.

Each week runs Monday to Sunday, with two weeks per A4 landscape page, just like the paper form. Days outside the period stay blank.

## Configuration

**Server** (environment variables)

| Variable | Needed | What it does |
| --- | --- | --- |
| `DATABASE_URL` | Online | Postgres connection string. Leave empty for the built-in local database. |
| `AUTH_SECRET` | Online | Signs logins for the website and the app. 32+ random characters. Changing it signs everyone out. |
| `POSTGRES_PASSWORD` | Docker | Password for the Postgres container. |
| `DEMO_MODE=1` | No | Shows the Demo data buttons on a production build. Never use it on the real system. |
| `APP_ORIGINS` | No | Extra hostnames to accept if a reverse proxy rewrites the Host header. |
| `NEXT_PUBLIC_MAP_TILES` | No | Different map tiles for the website. The default is CARTO Voyager (OpenStreetMap data). |

**Phone app** (`mobile/eas.json`, under each build profile's `env`)

| Variable | What it does |
| --- | --- |
| `EXPO_PUBLIC_API_URL` | The server's HTTPS address, built into the app. Empty means the app asks on first launch. |
| `EXPO_PUBLIC_MAP_TILES` | Different map tiles for the app's Clock screen. |

## Project layout

```
src/app/admin/          website: today, staff, records, requests, print, settings
src/app/app/            the public "Get the MyAttendance app" page (/app)
src/app/print/          the printable LPS form for admins
src/app/(staff)/        staff web screens, used only when web clock-in is turned on
src/app/api/            JSON API used by the website and the phone app
src/lib/                database, auth, time (MYT), geofence, attendance rules, print form
mobile/app/             phone app screens (Expo Router): clock, history, requests, print, profile, login
mobile/src/             app components, API client, location, map (Leaflet in a WebView)
mobile/src/shared/      time, rules and geofence code copied from src/lib (run npm run sync-shared after editing those)
db/schema.sql           the database schema (also created automatically)
```

Built with Next.js 16, React 19, Tailwind CSS 4, Leaflet and Postgres (postgres.js, or PGlite locally) for the server, and Expo SDK 58 with React Native 0.88 for the app. The colours follow the DAICOE palette (navy, teal, blue-purple, gold): `src/app/globals.css` for the website, `mobile/src/theme.ts` for the app. To use the official DAICOE logo, replace `public/icons/icon.svg` and the PNG icons next to it, and the images in `mobile/assets`.
