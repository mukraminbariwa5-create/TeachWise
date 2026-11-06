# Account matching and evaluation flow review

Verified November 6, 2026 (Asia/Manila).

The subsequent [administrator responsibility review](ADMIN-RESPONSIBILITIES.md) supersedes earlier school-admin management permissions and contains the latest test totals. Department people and approved IDs are now managed by their dean; the school office controls the shared framework and administrator accounts.

## Current rules

- Students choose their school and register using an approved ID from that school's list. The school must complete the approved name and section before signup can proceed; students cannot choose another class group. The section represents course, year and section; eligible teacher–subject pairs come from its class assignments in the school's active semester. Home displays the matched section and semester and refreshes assignments every 30 seconds while open.
- Department admins assign active teachers and subjects to sections in their own department. Each assignment must have a semester; the API defaults an omitted semester to the school's current semester. Bulk imports also require a current semester and enforce department boundaries. Student Home excludes other sections, inactive semesters, inactive teachers and legacy assignments without a semester. Without an active semester, no classes are listed.
- Teachers join using a school-issued, one-time invitation. The school, role, department and any supplied name, employee ID and email are authoritative. School-supplied identity fields are locked in the signup UI and enforced again by the API. Passwords and usernames are chosen by the account owner.
- Teachers can evaluate active colleagues in their own assigned department only. Shared subjects are not required. Self-evaluation, another department, another school, inactive colleagues and unassigned evaluators are blocked. A teacher without a department sees instructions to contact the admin.
- Department membership uses the admin-assigned department ID. If BSED and BSIT need separate peer groups, configure them as separate departments and assign teachers accordingly. A course/program name alone does not establish a teacher's department.
- Both evaluation types require their school's open evaluation period for the active semester (or an unbound period). Old-semester periods cannot authorize current submissions. School administrators still control whether peer evaluation is enabled.
- Duplicate checks and evaluation creation run inside a transaction after locking the evaluator's user record. This also serializes peer submissions, whose nullable class-offering ID cannot reliably enforce SQL uniqueness by itself. Invitations are locked and checked again when redeemed.

## Fixed during this review

1. Direct student form/submission URLs previously checked only the section, allowing a same-section class from another semester. They now use the dashboard's eligibility rules and exclude inactive teachers.
2. Staff signup previously accepted replacement identity details even when the invite contained school-supplied values. The supplied values now take precedence in both UI and API, with uniqueness validation applied to the actual values saved.
3. Peer matching previously required a shared subject. It now follows the requested strict department-only policy throughout the dashboard, form and submission endpoints. Admin help text and Wise's product guidance agree with that policy.
4. Evaluation-period selection now excludes inactive semesters. Duplicate submission checks and invitation redemption now use database row locks within transactions.
5. Incomplete approved IDs previously allowed manual section selection. Signup now stops until the school completes the record. The approved-ID screen highlights missing details, accepts complete updates by reimporting IDs, and recognizes both `BSIT 2A` and `BSIT 2-A` section labels.
6. Class assignment forms now require and display the semester and use numeric section/semester IDs when editing. Department boundaries are enforced for all three assignment fields and bulk imports; department admins cannot overwrite an approved ID belonging to another department. Class assignments with saved evaluations cannot be reassigned to another teacher, subject, section or semester, preserving history.

## Evidence

- Backend suite: **102 tests, 770 assertions passed** against SQLite in-memory storage. Workflow tests cover dean-created BSIT 2-A assignments through roster signup, exact subject matching, submissions and history; semester switching; missing semesters; cross-department assignment/import/roster rejection; incomplete approved IDs; authoritative staff identity; and department-only peers. Existing tests cover school separation, role access, closed periods, required answers, duplicate evaluations, privacy thresholds, invites and recovery.
- Latest verification used automated API tests only, without opening a browser or controlling the desktop. `EnrollmentEvaluationJourneyTest` creates two new invited department teachers, assigns Programming Fundamentals to one of them for BSIT 2-A, approves and registers a new student, signs in again with the saved credentials, submits the student evaluation and verifies History/completed status. The second teacher signs in and evaluates the first; saved ratings and peer completion are checked. Duplicate submissions are rejected, low-response student feedback stays private, and incomplete/closed peer submissions save nothing. The two new tests pass with 48 assertions; no application changes were needed after this verification.
- TypeScript: `npm run typecheck` passed.
- Real Edge browser flow passed: `app/scripts/verify-assignment-flow.cjs` runs against a freshly seeded, separate SQLite API. The dean uses the actual class-assignment form to assign Programming Fundamentals and Database Fundamentals to BSIT 2-A in the current first semester, then pastes the complete student record into Approved IDs using the `BSIT 2A` label. The signup wizard blocks an incomplete ID, locks the approved name/section for the complete ID, and creates the student. Home shows exactly the two new assignments and the correct section/semester; submission through rating/review screens is saved in History. The same check then registers an invited teacher and submits a department-only peer evaluation. No API fixtures substitute for these account/evaluation responses.
- Browser screenshots (including `dean-assigned-classes.png` and `new-student-home.png`) are under ignored `.ui-checks/assignment-flow/`; temporary API logs use `.ui-checks/student-assignment-api.*.log`. No school-account writes were made by the browser tests. Home counts class evaluations, so a teacher assigned to two subjects is correctly shown as two classes remaining.
- SQLite tests validate behavior but do not prove simultaneous MySQL request timing; the concurrency protection is the explicit transactional row lock. Physical Android verification was not part of this review.

## Local setup still required

The read-only audit of the normal local database found:

| School | Active teachers without departments | Approved IDs lacking name/section | Open student / peer period |
| --- | --- | --- | --- |
| DEMO | 0 | 12 | No / No |
| SAMPLE | 0 | 0 | No / No |

Both schools have one active semester and no registered students missing a section. The DEMO departments are College of Computer Studies and College of Education; SAMPLE has Business Department. The incomplete roster entries need school-supplied names and sections before automatic matching is possible. Evaluation periods need approved dates before evaluations become available. This review did not fabricate roster details, rename departments or open periods in the normal database.
