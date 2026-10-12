# Google Play store listing

Copy these into the Play Console. TeachWise is one app for every school that uses it.

## App details

| Field | Value |
|---|---|
| App name | TeachWise |
| Package | com.teachwise.app |
| Category | Education |
| Tags | Education, Productivity |
| Contact email | your support email (same as `TEACHWISE_SUPPORT_EMAIL`) |
| Privacy policy URL | `https://teachwise.example.edu/legal/privacy` |
| Price | Free, no ads, no in-app purchases |

## English

**Short description** (80 characters max)

> Anonymous teacher evaluations made quick and friendly, with Professor Wise.

**Full description**

> TeachWise brings anonymous teacher evaluation to colleges and universities. Students rate their teachers in about three minutes per class, and teachers see clear, anonymous results that help them improve. Each school runs its own space, and its data stays private to that school.
>
> HOW TO JOIN
> • Students: choose your school (search, school code or the join link from your school), then sign up with your student ID
> • Teachers and staff: use the invite code from your school admin
> • Schools: tap “For schools” to bring TeachWise to your campus
>
> FOR STUDENTS
> • See every teacher you need to evaluate, with the deadline
> • One question at a time, with friendly faces for each rating
> • Your answers are saved on your phone if you need to stop
> • Completely anonymous: teachers never see your name
>
> FOR TEACHERS
> • Your rating over time and by criteria, with your strongest and focus areas
> • Anonymous comments from students
> • Peer evaluation of colleagues who teach the same subject
> • A full report you can print or save as PDF
>
> FOR ADMINS
> • Set up departments, programs, sections, subjects, classes and evaluation periods
> • Invite teachers with one-time codes; deans can manage just their college
> • Approve student IDs by pasting a list from a spreadsheet
> • Track completion by section and send reminders
> • Faculty reports and a CSV export
>
> Professor Wise, the TeachWise mascot, guides everyone along the way and answers questions about evaluations.
>
> Available in English and Filipino, with dark mode.
>
> TeachWise follows the Data Privacy Act of 2012 (RA 10173). You can download your data or delete your account at any time in Settings.

## Filipino

**Maikling paglalarawan**

> Mabilis at magiliw na anonymous na evaluation ng guro, kasama si Professor Wise.

**Buong paglalarawan**

> Dinadala ng TeachWise ang anonymous na teacher evaluation sa mga kolehiyo at unibersidad. Nire-rate ng mga estudyante ang kanilang mga guro sa loob ng mga tatlong minuto bawat klase, at nakikita ng mga guro ang malinaw at anonymous na resulta. May sariling espasyo ang bawat paaralan, at pribado ang data nito.
>
> PAANO SUMALI
> • Estudyante: piliin ang paaralan (hanapin, school code o join link), saka mag-sign up gamit ang student ID
> • Guro at staff: gamitin ang invite code mula sa admin ng paaralan
> • Paaralan: pindutin ang “Para sa paaralan” para dalhin ang TeachWise sa campus ninyo
>
> PARA SA MGA ESTUDYANTE
> • Makikita ang lahat ng gurong ie-evaluate at ang deadline
> • Isang tanong bawat pagkakataon, may mukha sa bawat rating
> • Naka-save sa phone mo ang mga sagot kung kailangan mong huminto
> • Ganap na anonymous: hindi kailanman makikita ng guro ang pangalan mo
>
> PARA SA MGA GURO
> • Rating mo sa paglipas ng panahon at ayon sa pamantayan
> • Anonymous na komento mula sa mga estudyante
> • Peer evaluation ng mga kasamahang may parehong subject
> • Buong report na puwedeng i-print o i-save bilang PDF
>
> PARA SA MGA ADMIN
> • Pag-set up ng semestre, section, subject, klase at evaluation period
> • Pag-apruba ng student ID sa pamamagitan ng pag-paste mula sa spreadsheet
> • Pagsubaybay ng pagkumpleto ayon sa section at pagpapadala ng paalala
> • Mga report ng faculty at CSV export
>
> Ginagabayan ni Professor Wise, ang mascot ng TeachWise, ang lahat at sinasagot ang mga tanong tungkol sa evaluation.
>
> May English at Filipino, at dark mode.
>
> Sumusunod ang TeachWise sa Data Privacy Act of 2012 (RA 10173). Puwede mong i-download ang data mo o burahin ang account mo anumang oras sa Settings.

## Graphics checklist

| Asset | Size | Source |
|---|---|---|
| App icon | 512 × 512 PNG | `app/public/icons/icon-512.png` |
| Feature graphic | 1024 × 500 PNG | Navy background, logo lockup (`app/assets/brand/logo-lockup.png`) and Professor Wise |
| Phone screenshots | at least 2, 1080 × 1920 | Sign in, student home, evaluation question, teacher dashboard (use demo data on your own computer) |
| Tablet screenshots | optional | The computer layout at 1920 × 1200 |

## Content rating

Answer the IARC questionnaire: **no** violence, sexual content, profanity, drugs, gambling or user-to-user chat. Users can send text to the school's admins (help messages and evaluation comments), which are moderated by the school. Expected rating: **Everyone / PEGI 3**.

## Target audience

College students and staff, **18 and over**. Not designed for children.

## Data safety form

| Question | Answer |
|---|---|
| Does the app collect or share user data? | Collects: yes. Shares with third parties: **no**. |
| Is data encrypted in transit? | **Yes** (HTTPS only). |
| Can users ask for their data to be deleted? | **Yes**: Settings → Delete account (students), or a request to the admin (staff). |

Data types collected:

| Data type | Collected | Purpose | Optional? |
|---|---|---|---|
| Name | Yes | Account management | Required (from school records) |
| Email address | Yes | Account management (password recovery) | Optional |
| Phone number | Yes | Account management | Optional |
| User IDs (student/employee ID) | Yes | Account management | Required |
| Other user-generated content (evaluation answers and comments) | Yes | App functionality | Required to use the app |
| Crash logs | Yes | Analytics (app stability) | Automatic |
| Device or other IDs (push token) | Yes | App functionality (notifications) | Optional (only if notifications are allowed) |

Not collected: location, contacts, photos, files, audio, health, financial info, browsing history, advertising ID.

Evaluation answers are stored without being shown to the evaluated teacher with any identity, and when a student deletes their account their past evaluations stay anonymous with no link to them.
