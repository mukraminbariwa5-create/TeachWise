# Deploying TeachWise

This guide puts TeachWise online so **any number of schools** can use it from one app and one server:

- the **API** (Laravel) and **database** (MySQL) on a paid web host,
- the **web app** at your own address (it also installs like an app from Chrome or Edge),
- the **Android app** on Google Play, or as an APK you hand out yourself.

It is written for a typical paid host with **cPanel or hPanel** (Hostinger, Namecheap, SiteGround and similar). You need PHP 8.2 or newer, MySQL 8, SSH access, cron jobs and free SSL. Any VPS works too; the steps are the same.

### How TeachWise works with many schools

- **One Play Store app and one server.** Every school's data is kept separate: each request is locked to the signed-in person's school, so nobody can reach another school's people or results.
- **You are the owner.** You approve schools that apply, send their first admin an invite code, and can pause or remove a school. You see counts only, never evaluation answers.
- **Schools run themselves.** A school's admin invites teachers with codes, pastes the approved student ID list, and shares the school's join link (e.g. `teachwise.example.edu/join/MSUSULU`). Deans can be department admins who only manage their college.
- **Students** choose their school (search, code or join link) and sign up with an ID that is on that school's list.

Throughout this guide:

| Replace | With |
|---|---|
| `teachwise.example.edu` | the web app address, e.g. `teachwise.yourcollege.edu.ph` |
| `api.teachwise.example.edu` | the API address (a subdomain) |

---

## 1. Prepare the host

1. **Domains.** Point both addresses at the host. In the panel, create the subdomain `api.teachwise.example.edu`.
2. **SSL.** Turn on free SSL (Let's Encrypt) for both addresses, and turn on **Force HTTPS**.
3. **PHP.** Set the PHP version to **8.3** (8.2 is the minimum). The extensions `pdo_mysql`, `mbstring`, `openssl`, `tokenizer`, `xml`, `ctype`, `json`, `bcmath` and `fileinfo` are usually on already.
4. **Database.** Create a MySQL database (e.g. `u123_teachwise`) and a user with a long password. Give the user **all privileges** on that database only.

## 2. Upload the API

1. Upload the whole `backend` folder to the host, **outside** `public_html`, e.g. `/home/u123/teachwise-api`.
   Don't upload `backend/.env`, `backend/vendor` or `backend/database/database.sqlite`.
2. Set the document root of `api.teachwise.example.edu` to `/home/u123/teachwise-api/public`.
   If the panel doesn't let you choose it, put this `.htaccess` in that subdomain's folder instead:

   ```apache
   RewriteEngine On
   RewriteRule ^(.*)$ /home/u123/teachwise-api/public/$1 [L]
   ```

3. Open **SSH** (Terminal in the panel) and run:

   ```bash
   cd ~/teachwise-api
   composer install --no-dev --optimize-autoloader
   cp .env.production.example .env
   php artisan key:generate
   ```

4. Edit `.env` (File Manager or `nano .env`). The important lines:

   ```ini
   APP_ENV=production
   APP_DEBUG=false
   APP_URL=https://api.teachwise.example.edu

   DB_DATABASE=u123_teachwise
   DB_USERNAME=u123_teachwise_user
   DB_PASSWORD=the-long-password

   CORS_ALLOWED_ORIGINS=https://teachwise.example.edu

   TEACHWISE_PLATFORM_NAME=TeachWise
   TEACHWISE_SUPPORT_EMAIL=you@yourdomain.com
   TEACHWISE_DPO_EMAIL=you@yourdomain.com
   TEACHWISE_STORE_URL=https://play.google.com/store/apps/details?id=com.teachwise.app
   ```

   Never leave `APP_DEBUG=true` on a live server: it shows internal details to anyone.

   Each school sets its own name, logo and contacts in the app (School settings). The emails above are yours, shown before anyone signs in and for school applications.

5. Create the tables and your owner account:

   ```bash
   php artisan migrate --force
   php artisan teachwise:create-admin --platform   # the TeachWise owner: approves schools
   php artisan optimize
   ```

   Running TeachWise for just one school? Create that school and its admin directly instead:
   `php artisan teachwise:create-admin --school=MSUSULU --school-name="Mindanao State University – Sulu"`.

   **Don't** run `teachwise:demo` here. Demo accounts with the password `password` don't belong on a real server (the command refuses in production anyway).

6. Check it: `https://api.teachwise.example.edu/api/app/info` should show `"school_name": "TeachWise"` as JSON.

## 3. Turn on the scheduler (notifications)

TeachWise sends "evaluation is open" and "closes in 24 hours" notifications and cleans up expired sign-ins on a schedule. In the panel, open **Cron Jobs** and add one job that runs **every minute**:

```bash
* * * * * cd /home/u123/teachwise-api && php artisan schedule:run >> /dev/null 2>&1
```

If the panel only offers 5-minute steps, that's fine too.

## 4. Publish the web app

On your own computer, in the `app` folder:

```bash
copy .env.example .env
```

Edit `app/.env` so it points at the live API:

```ini
EXPO_PUBLIC_API_URL=https://api.teachwise.example.edu/api
EXPO_PUBLIC_WEB_URL=https://teachwise.example.edu
```

Then build:

```bash
npx expo export -p web
```

Upload **everything inside** `app/dist` to the `public_html` folder of `teachwise.example.edu`. The included `.htaccess` makes links like `/student/history` work when opened directly, and caches files properly.

Open `https://teachwise.example.edu`, sign in with the owner account, and in Chrome or Edge you'll see **Install TeachWise** in the address bar.

## 5. Bring schools on board

**A school applies.** Someone from the school (registrar, QA office, dean) taps **For schools** on the sign-in page and fills in the form. You get a notification.

**You approve it.** In the owner console, open **Schools**, check that the contact really works at that school (call or email the school's official address), then **Approve**. You get an invite code; send it with the ready-made message (Copy invite message).

**The school sets itself up.** Their admin taps **Join with an invite code**, creates an account and sees a setup checklist:

1. **School settings**: place, logo (upload from a computer), help email and Data Protection Officer.
2. **Departments & programs**: e.g. College of Computer Studies → BSIT, BSCS.
3. **Current semester** (or trimester/quarter).
4. **Invite teachers**: paste names, send each person their one-time code. Deans can be invited as department admins.
5. **Sections and classes**: paste rows of subject, section and teacher from Excel (*Import classes*), or add them one by one.
6. **Approved student IDs**: paste the registrar's list (ID, name, section).
7. **First evaluation period**: everyone is notified when it opens.

Then they share their **join link** (School settings → Copy announcement for students). Students choose the school, enter their ID and create their account.

**Paused or leaving schools.** Pause a school from its page (everyone is signed out). When a school asks to close its account, it first downloads its export (School settings → Export), you confirm by email, pause it, then delete it by typing its code.

## 6. Build the Android app

You need a free [Expo account](https://expo.dev/signup) and, for Google Play, a [Play Console](https://play.google.com/console) developer account (one-time US$25).

```bash
npm install -g eas-cli
eas login
cd app
eas init            # creates the project and fills in extra.eas.projectId in app.json
```

Edit `app/eas.json` and replace `https://teachwise.example.edu/api` with your API address in the `preview` and `production` profiles.

**APK to share directly** (installs on any Android phone, no store):

```bash
eas build -p android --profile preview
```

Expo emails you a download link for the `.apk` when it's done.

**Google Play** (`.aab`):

```bash
eas build -p android --profile production
eas submit -p android --profile production   # uploads to the Internal testing track
```

In the Play Console, fill in the store listing, content rating and **Data safety** form using `STORE_LISTING.md`, then promote the release from Internal testing to Production.

**Push notifications on Android** need Firebase credentials once: follow Expo's guide "Push notifications setup → Android: FCM credentials" and upload the key with `eas credentials`. Without it the app still shows notifications under the bell.

## 7. Releasing an update

1. Raise `version` (e.g. `1.1.0`) and `android.versionCode` (e.g. `2`) in `app/app.json`, and add a line to `app/src/lib/changelog.ts` so people see "What's new".
2. Build and submit as in step 6. Rebuild the web app as in step 4.
3. On the server, set `TEACHWISE_LATEST_APP_VERSION=1.1.0` in `.env` to show an "update available" note.
   To force everyone to update (e.g. after a breaking API change), also raise `TEACHWISE_MIN_APP_VERSION`.
4. Server updates: upload the new `backend` files, then run

   ```bash
   composer install --no-dev --optimize-autoloader
   php artisan migrate --force
   php artisan db:seed --class=QuestionSeeder --force
   php artisan optimize
   ```

## 8. Backups and security checklist

- [ ] **Daily database backups** are on in the host panel (most paid plans include them). Download one now and then to keep off-site.
- [ ] `APP_DEBUG=false` and `APP_ENV=production` in `.env`.
- [ ] HTTPS forced on both addresses.
- [ ] `CORS_ALLOWED_ORIGINS` lists only your web app address.
- [ ] The database user can only access the TeachWise database.
- [ ] No demo accounts or demo schools exist (the owner console lists only real schools).
- [ ] You verified every school you approved, using the school's official contact details.
- [ ] Each school set its help and Data Protection Officer emails, so its Privacy page shows the right contacts.
- [ ] Each school has two admins, and there are two owner accounts, so nobody is ever locked out.
- [ ] You have a short data processing agreement with each school (the school is the data controller, you are the processor under RA 10173).

## Troubleshooting

| Problem | Fix |
|---|---|
| "500 Server Error" on the API | Check `storage/logs/laravel.log`. Usually a wrong database password in `.env`; run `php artisan optimize` after editing it. |
| The web app says it can't reach the server | `EXPO_PUBLIC_API_URL` was wrong when you built, or `CORS_ALLOWED_ORIGINS` doesn't match the web address exactly (no trailing slash). |
| Opening `/student` directly gives 404 | The `.htaccess` from `app/dist` wasn't uploaded (hidden files may be off in File Manager). |
| No "evaluation is open" notifications | The cron job isn't running. Run `php artisan schedule:run` once in SSH to test. |
| `storage` permission errors | `chmod -R 775 storage bootstrap/cache` |
