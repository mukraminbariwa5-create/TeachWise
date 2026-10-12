# TeachWise

Anonymous instructional evaluation for colleges, on **Android** and the **web**, with Professor Wise, the owl who guides everyone through it.

One app and one server for **many schools**. Each school gets its own private space: students join with their school's code or link and their approved ID, teachers join with invite codes, and deans can manage just their college. The TeachWise owner approves schools and never sees evaluation answers.

Students rate their teachers in about three minutes per class. Teachers see clear, anonymous results with trends, focus areas and comments (shown only once enough students answered). Admins run the whole process: departments and classes, evaluation periods, approved student IDs, invites, reminders and faculty reports.

| Folder | What it is |
|---|---|
| `backend/` | Laravel 12 REST API + MySQL ([setup](backend/README.md)) |
| `app/` | React Native + Expo app for Android and the web ([setup](app/README.md)) |
| `DEPLOY.md` | Putting it online: hosting, web app, APK and Google Play |
| `STORE_LISTING.md` | Play Store texts (EN/FIL), content rating and data safety answers |

## On your own computer (Windows + XAMPP)

| Double-click | When |
|---|---|
| `setup-database.bat` | First time, or to reset everything to demo data (erases the database) |
| `update-database.bat` | After getting a new version (keeps your data) |
| `install-app-packages.bat` | After getting a new version that needs new app packages |
| `start-teachwise.bat` | Every time: starts the API and the app |
| `restart-app.bat` | If the app window is stuck or new files don't show up |
| `load-demo-data.bat` | Adds sample schools and accounts to an existing database |
| `create-owner.bat` | Creates the TeachWise owner account (approves schools) |
| `create-admin.bat` | Creates an admin for a school (or a new school) |

Demo accounts (password `password`):

| Username | Who |
|---|---|
| `owner` | TeachWise owner: approves and pauses schools |
| `admin` | School admin, Demo State University (school code `DEMO`) |
| `ccsdean` | Department admin, College of Computer Studies |
| `lsantos` | Teacher · `aisha` Student |
| `sampleadmin` · `mara` | Admin and student of a second school, Sample Community College (`SAMPLE`) |

Northern Isles College is a demo application waiting for approval.

## Highlights

- Anonymous by design: evaluator identities are never sent to teachers, and stay unlinked when a student deletes their account
- English and Filipino, light and dark mode, accessible labels, keyboard shortcuts on computers
- Works offline with cached data and saved drafts; push notifications on phones
- Data Privacy Act (RA 10173) ready: privacy notice and consent, download my data, delete account, audit log
- Login lockout, short or long sessions, device management, security headers
- Many schools on one server with strict data separation, tested on every push (68 API tests, GitHub Actions)
