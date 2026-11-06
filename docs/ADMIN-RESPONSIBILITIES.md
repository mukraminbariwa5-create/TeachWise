# School and department administrator responsibilities

Implemented November 6, 2026 (Asia/Manila). Existing accounts keep their school and department assignments; no migration or school-record rewrite is required.

See the [final workflow review](FINAL-WORKFLOW-REVIEW.md) for subsequent roster, period-history and account-cache fixes and the latest verification results: 113 tests, 878 assertions.

School-wide account identity was subsequently clarified: Profile, Account and the account menu show **School administrator** rather than a department. The school admin can edit **Profile → School / managing office** to use the institution or its authorized office name; this changes the account's display name, not its school, credentials or scope. Dean/teacher/student names remain school-controlled. Legacy department text is excluded from school-admin API presentation. The DEMO school account's old `CCS Admin` / `Dean's Office` labels were corrected to `Demo State University` / no department, with an audit record. New demo seeds and school-admin creation avoid department-style labels. Verification now passes **115 tests, 899 assertions**, plus TypeScript and desktop/phone office-name profile checks.

| Capability | School admin | Department dean |
| --- | --- | --- |
| School profile, departments, programs | Manage | View own department |
| Semesters, evaluation dates, shared questions and rating scale | Manage | Read only |
| Administrator accounts and administrator invitations | Manage | No account-management access |
| Teachers, students, approved IDs, subjects, sections, classes | No routine management | Manage own department only |
| Teacher invitations and manual student reminders | No | Own department only |
| Password requests and support inbox | Administrator accounts | Own department's teachers and students |
| Faculty results, reports, CSV/PDF | Read school-wide | Read own department |
| Submitted ratings and comments | Cannot edit | Cannot edit |
| Cross-department transfers | Explicit audited transfer | Coordinate with school office |

## Enforcement

`department_admin` middleware protects department resources, imports and reminders. `school_admin` middleware protects shared framework changes, school setup and transfers. Account administration uses `AdminScope::managedUsers`, independently of the wider read-only reporting scope. School admins cannot edit department accounts, reset their passwords or issue teacher invitations through direct API calls. Deans cannot elevate roles, change departments or manage administrator accounts.

School-admin navigation exposes Administrator accounts, School structure, Evaluation setup, Reports, Requests, School settings, Activity and Department transfers. Approved IDs and class editing are reserved for deans. Direct school-admin Approved IDs links redirect to Overview. Deans can inspect the school calendar and shared questions without add/edit/delete controls; shared setup mutations are also rejected by the API. Phone Manage links follow the same rules.

Students need a complete approved name and a section linked to a department's program before signup. Teacher invitations must assign a valid department. Student evaluation eligibility excludes teachers without a valid department. The school setup checklist asks the school office to appoint active deans for every department rather than inviting teachers or importing approved IDs itself. The last active dean of a department with active people cannot be removed or reassigned until a replacement is appointed.

Password-reset requests and teacher/student support messages notify the responsible dean. Deans contact the school office; school-office support messages go to TeachWise support. Department inbox access, closing messages and resolving password requests enforce the same ownership scope. Manual dean reminders include only active students with eligible classes in the current semester.

## Transfers and history

The school office records approved cross-department moves under Department transfers, with a school ID, destination department, destination section for students, reason and explicit confirmation. The change is transactional and audited. A student's approved-ID section follows the transfer. Teacher transfers are blocked while the teacher has current-semester assignments, requiring coordination of the handover first. Existing evaluations, answers, ratings and comments remain intact.

There are no result-editing routes. Evaluated class assignments cannot be repurposed, and questions with submitted answers cannot have their original English criterion, category, audience or answer type rewritten. Future forms use a new question and deactivate the old one after the period closes. Filipino translations can be corrected; English form changes remain locked during an open period. Moving a program with existing sections to another department is blocked, preventing a mass transfer through school-structure editing.

## Verification

- Backend: **109 tests, 856 assertions passed**, using SQLite in-memory storage. New responsibility tests cover both role boundaries, department recovery/support ownership, transfer authorization, transfer history preservation, teacher handover requirements, replacement deans and immutable result criteria. Historical CSV exports retain retired criteria with submitted answers. Existing signup, student evaluation, teacher peer evaluation, school separation and chat tests pass.
- TypeScript: `npm run typecheck` passed.
- Headless browser: `app/scripts/verify-admin-responsibilities.cjs` passed with isolated API fixtures for both roles on desktop and phone layouts. Checked menu visibility, blocked school Approved IDs navigation, administrator versus teacher invitations, shared questions/calendar without dean editing controls, and absence of unauthorized roster requests.
- The real signup/evaluation browser check also passed against a separately seeded SQLite API: dean class assignment, approved-ID import, student signup and evaluation/history, teacher invitation and department peer evaluation. The temporary API was stopped afterwards; normal school records were never used for test writes. Physical Android-device testing and simultaneous MySQL transfer timing are outside this verification.
