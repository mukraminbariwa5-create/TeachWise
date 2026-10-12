# TeachWise API

Laravel 12 backend for TeachWise, the instructional performance assessment and
recommendation app. The Android and web app (React Native + Expo) talks to this
API with Sanctum bearer tokens.

## Requirements

- PHP 8.2 or newer (XAMPP 8.2+ is fine)
- Composer — https://getcomposer.org/download/ (run `Composer-Setup.exe` and point it to `C:\xampp\php\php.exe`)
- MySQL / MariaDB from XAMPP

In `C:\xampp\php\php.ini`, make sure these lines are **not** commented out (no `;` in front):

```
extension=fileinfo
extension=zip
extension=pdo_mysql
```

## First-time setup (Windows + XAMPP)

1. Start **MySQL** in the XAMPP Control Panel.
2. Open http://localhost/phpmyadmin and create an empty database named **`teachwise_db`**
   (collation `utf8mb4_unicode_ci`). Your old `fefs_db` is not touched.
3. Open a terminal in this `backend` folder and run:

```bash
composer install
copy .env.example .env
php artisan key:generate
php artisan migrate --seed
php artisan teachwise:demo      # optional: sample school data to try the app
php artisan serve
```

The API is now running at **http://localhost:8000/api**.
Check it in a browser: http://localhost:8000/up should show a green page.

A clean install has **no schools and no accounts**. Create the TeachWise owner with
`php artisan teachwise:create-admin --platform` (schools then apply from the app), or a school and its
admin directly with `php artisan teachwise:create-admin --school=CODE --school-name="…"`. Or load the demo data.

To start over with fresh demo data: `php artisan migrate:fresh --seed && php artisan teachwise:demo`

## Demo accounts

All demo accounts use the password **`password`**. Sign in with the username (ID numbers
work too, but the same ID can exist at two schools, so the app then asks which school).

| Role | Username | School | Notes |
|---|---|---|---|
| Owner | `owner` | — | Approves and pauses schools; sees counts only |
| School admin | `admin` | Demo State University (`DEMO`) | |
| Department admin | `ccsdean` | DEMO | College of Computer Studies only |
| Teacher | `lsantos` | DEMO | Prof. Liza Santos, has peers |
| Teacher | `mlopez` | DEMO | College of Education (outside the dean's department) |
| Student | `aisha` | DEMO | ID 2023-0001, BSIT 4-A, 2 of 4 evaluations done |
| Admin | `sampleadmin` | Sample Community College (`SAMPLE`) | Peer evaluation off, trimesters |
| Student | `mara` | SAMPLE | Also ID 2023-0001 |

Northern Isles College (`NIC`) is waiting for approval in the owner console.

### How schools are kept apart

Every school-owned table has a `school_id`. The `SetTenant` middleware puts each request inside the
signed-in person's school *before* route models load, and the `BelongsToSchool` trait limits every query
to that school and fills in `school_id` on new rows. Validation uses `Tenant::exists()` / `Tenant::unique()`
so IDs from another school are rejected. Department admins are further limited by `AdminScope`.
See `tests/Feature/MultiSchoolTest.php`.

`teachwise:demo` refuses to run when `APP_ENV=production`. To put TeachWise online, follow `../DEPLOY.md`.

## Professor Wise (AI assistant)

Wise always works. With Ollama turned off it answers common questions from the
user's real data (pending evaluations, deadlines, ratings, completion). To use
your local Ollama model instead, install Ollama, run `ollama pull llama3.2`,
then set in `.env`:

```
OLLAMA_ENABLED=true
OLLAMA_MODEL=llama3.2
```

If Ollama stops responding, Wise falls back to the built-in answers.

## Letting your phone reach the API

`php artisan serve` only listens on your PC by default. For the Android app use:

```bash
php artisan serve --host=0.0.0.0 --port=8000
```

## Running the tests

```bash
php artisan test
```

Tests use an in-memory SQLite database, so they never touch MySQL.

## API overview

Send `Accept: application/json` on every request, and
`Authorization: Bearer <token>` on every request after login.

| Method | Endpoint | Who | What it does |
|---|---|---|---|
| POST | `/api/auth/login` | anyone | `{login, password, device_name?}` → `{token, user}` (5 tries/min) |
| POST | `/api/auth/register` | anyone | Student sign-up; ID number must be whitelisted |
| GET | `/api/sections` | anyone | Sections for the sign-up screen |
| GET | `/api/auth/me` | signed in | Current user |
| POST | `/api/auth/logout` | signed in | Revokes the current token |
| PUT | `/api/auth/password` | signed in | Change password |
| GET | `/api/notifications` | signed in | Latest notifications + unread count |
| POST | `/api/notifications/{id}/read` · `/read-all` | signed in | Mark as read |
| GET | `/api/wise/messages` | signed in | Professor Wise greeting, suggestions and chat history |
| POST | `/api/wise/messages` | signed in | `{message}` → Wise's reply (20/min) |
| DELETE | `/api/wise/messages` | signed in | Clear chat history |
| GET | `/api/student/dashboard` | student | Teachers to evaluate, subjects, progress, period |
| GET | `/api/student/offerings/{id}/form` | student | Questions for one class |
| POST | `/api/student/evaluations` | student | `{class_offering_id, answers:[{question_id, rating}], comment?}` |
| GET | `/api/student/history` | student | Own past submissions |
| GET | `/api/teacher/dashboard` | teacher | Overall rating, criteria, comments, subjects, peers |
| GET | `/api/teacher/feedback` | teacher | Paginated anonymous comments (`?offering_id=`) |
| GET | `/api/teacher/report` | teacher | Own full report (`?period_id=`) |
| GET | `/api/teacher/peers/{id}/form` | teacher | Peer evaluation questions |
| POST | `/api/teacher/peer-evaluations` | teacher | `{teacher_id, answers, comment?}` |
| GET | `/api/admin/dashboard` | admin | Stats, completion by section, faculty overview |
| POST | `/api/admin/reminders` | admin | Notify students with pending evaluations |
| GET/PUT/DELETE | `/api/admin/users` · POST `/api/admin/users/{id}/temporary-password` | admin | Correct accounts, turn them off, give a temporary password. **No create**: students sign up with an approved ID, staff join with an invite (`/api/admin/invites`) |
| CRUD | `subjects` · `sections` · `semesters` · `offerings` · `questions` · `periods` · `whitelist` · `departments` · `programs` | admin | Manage school data. Records with history (classes, evaluations) can't be deleted, and questions are locked while their period is open |
| GET | `/api/admin/reports/faculty/{id}` | admin | Full report for one teacher |
| GET | `/api/admin/reports/faculty.csv` | admin | CSV of all teachers |
| GET | `/api/admin/password-requests` · POST `…/{id}/resolve` | admin | Forgot-password requests; resolving returns a temporary password |
| GET | `/api/admin/inbox` · POST `…/{id}/close` | admin | Help messages, problem reports, deletion requests |
| GET | `/api/admin/activity` · `/api/admin/app-errors` | admin | Audit log and crash reports |
| GET/PUT | `/api/me/settings` · `/api/me/profile` | signed in | Notification and tip settings, contact details |
| GET/DELETE | `/api/me/sessions` · `/api/me/sessions/{id}` · `/others` | signed in | Signed-in devices |
| GET | `/api/me/export` · DELETE `/api/me` | signed in | Download my data · delete account |
| POST | `/api/support` | signed in | Message the admin or report a problem |
| GET | `/api/app/info` | anyone | School name, contacts, latest/minimum app version |

## Commands

| Command | What it does |
|---|---|
| `php artisan teachwise:create-admin` | Create an admin (asks questions, or use `--name --username --password`) |
| `php artisan teachwise:demo` | Load sample data (not in production) |
| `php artisan teachwise:notify` | "Evaluation open" and "closes in 24 h" notifications (runs hourly via `schedule:run`) |

## How the data fits together

```
users (admin / teacher / student)
 └─ student_profiles ─ section
class_offerings = teacher + subject + section + semester
evaluation_periods (Midterm, Finals, Faculty-to-faculty)
questions (student or peer form)
evaluations ─ evaluation_answers
```

- A student evaluates every class offering of their section, once per period.
- A teacher evaluates colleagues who teach at least one of the same subjects.
- `evaluations.evaluator_id` is only used to stop duplicate submissions. It is
  hidden from every API response, so feedback stays anonymous to teachers.

## Folder guide

```
app/Http/Controllers/Api/   AuthController, NotificationController
  Student/StudentController.php
  Teacher/TeacherController.php
  Admin/*Controller.php
app/Services/EvaluationService.php   saving and validating evaluations
app/Services/RatingStats.php         averages, criteria scores, comments
app/Services/WiseService.php          Professor Wise answers (Ollama or built-in)
app/Support/Present.php              JSON shapes shared by all endpoints
database/migrations/                 the TeachWise schema
database/seeders/                    question bank + demo data
tests/Feature/                       API tests
```

## Security note

This folder sits inside `htdocs`, so `.htaccess` blocks Apache from serving
it directly (that would expose `.env`). Always run it with `php artisan serve`,
or move the `teachwise` folder outside `htdocs`.
