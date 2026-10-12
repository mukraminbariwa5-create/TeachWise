# TeachWise App

React Native + Expo app for **Android** and the **web**, built from one codebase.
It talks to the Laravel API in `../backend`.

## What's in it

- **Everyone:** sign in or sign up with live checks, forgot password, stay signed in, signed-in devices,
  profile, settings (appearance, language, notifications), help & feedback, privacy and terms,
  download my data, delete account, English and Filipino, light and dark mode, works offline.
- **Students:** dashboard with a guided tour, one-question-at-a-time evaluation with drafts, history, badges.
- **Teachers:** rating trend, criteria with focus area, anonymous comments, peer evaluation, printable report.
- **Admins:** overview with completion and reminders, users, classes & sections, evaluation periods and
  questions (EN/FIL), approved IDs (paste from a spreadsheet), password requests and inbox, reports + CSV, activity log.
- **Professor Wise** on every page: tips, a chat, and reactions while you work.
- Push notifications on phones, installable web app, crash reports, "What's new" and update prompts.

## Requirements

- Node.js 20 LTS or newer — https://nodejs.org
- The backend running (see `../backend/README.md`)
- For Android: the **Expo Go** app from the Play Store

## First-time setup

```bash
cd app
copy .env.example .env
npm install
npx expo install --fix
```

On Windows you can just double-click `install-app-packages.bat` in the main folder.

`npx expo install --fix` lines every Expo package up with your Expo SDK
version, so run it once after `npm install`.

## Run it on the web

1. Start the API in another terminal: `cd ../backend` then `php artisan serve`
2. In this folder: `npx expo start --web`
3. Your browser opens at http://localhost:8081. Sign in with `aisha` / `password` (after loading the demo data).

## Run it on your Android phone

Your phone and PC must be on the **same Wi-Fi**.

1. Find your PC's IP address: run `ipconfig` and look for **IPv4 Address**, e.g. `192.168.1.5`.
2. In `.env`, set `EXPO_PUBLIC_API_URL=http://192.168.1.5:8000/api` (use your IP).
3. Start the API so the phone can reach it:
   `php artisan serve --host=0.0.0.0 --port=8000`
   If Windows asks about the firewall, allow access on **private networks**.
4. Start Expo: `npx expo start` and scan the QR code with the Expo Go app.

If Expo Go says the project uses an unsupported SDK, update it:

```bash
npx expo install expo@latest
npx expo install --fix
```

## Demo accounts

Password `password` for all: `owner` (TeachWise owner), `admin` (school admin), `ccsdean` (department admin),
`lsantos` (teacher), `aisha` (student), and `sampleadmin` / `mara` at a second school. See `../backend/README.md`.

## Folder guide

```
src/app/                 Screens. The file path is the URL (Expo Router)
  login.tsx · legal/     Sign in / sign up, terms and privacy
  student/               Dashboard, evaluate/[offeringId], history, wise, account, profile, settings, help
  teacher/               Dashboard, feedback, report, peers/[peerId], wise, account…
  admin/                 Overview, users, academics, evaluation, ids, requests, reports, activity, account…
  print/report.tsx       Clean page for Print / Save as PDF
src/screens/             Shared Account, Profile, Settings, Help and Legal screens
src/components/          Shell, ui kit (Screen, Section, ListRow, Sheet, Panel…), EvaluationFlow,
                         Charts, ReportView, admin/ (DataList, FormSheet, CrudSection), Professor Wise
src/api/                 API client, types and data hooks (TanStack Query); admin.ts for admin
src/auth/                Session (Zustand) and secure token storage
src/lib/                 i18n, theme, push, offline cache, settings, PWA, error reports
src/theme.ts             Colours (light + dark), spacing and type scale
```

Phones (< 768 px) get the bottom tab bar with Professor Wise in the middle; tablets and computers get the navy sidebar.

## Publishing

See `../DEPLOY.md` for the web app, the APK and Google Play, and `../STORE_LISTING.md` for the store texts.
