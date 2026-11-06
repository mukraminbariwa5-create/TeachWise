# Final workflow and permission review

Verified November 6, 2026 (Asia/Manila). Test writes used in-memory SQLite or a separately seeded throwaway database; normal school records were not modified.

## Additional gaps fixed

1. **Historical evaluation periods:** A period with saved evaluations could be reassigned to another semester or changed from student to peer evaluation. Its type and semester are now fixed once answers exist. Authorized date corrections remain available.
2. **Student roster consistency:** Editing an enrolled student's name, ID or section in People now updates their approved record in the same transaction. The previous ID cannot remain as a separate signup entry. IDs already approved for someone else cannot be appropriated. Reimporting a conflicting enrolled record directs the dean to People; deleting a roster row no longer allows another department to claim that enrolled ID. Imported IDs follow signup's 30-character limit.
3. **Account and department cache ownership:** Saved query data now includes school, account, role, admin scope, department and section identity. Session hydration finishes before cache restoration. Another account's, another class group's, a previous department's or an unowned legacy cache is discarded before rendering. Correctly owned offline data still loads. Account changes clear outstanding queries and cached data; background account responses cannot overwrite a different token's session. Administrator people, approved IDs, invitation codes and account-request lists are excluded from persistent query caching.
4. **Transferred sessions:** Department transfers and administrator department changes revoke previous sessions so the next sign-in refreshes permissions and cache identity. Corrupt cached account details fail back to sign-in rather than leaving startup stuck.

## Verification results

| Check | Result |
| --- | --- |
| Complete backend suite | **113 tests, 878 assertions passed** |
| New roster/period/session edge cases | 4 tests, 22 assertions passed |
| TypeScript | Passed |
| Real browser → isolated API → database journey | Passed: dean assignments, approved roster import, student signup, assigned Home list, student evaluation/history, teacher invite and department peer evaluation |
| Administrator desktop/phone controls | Passed, including previous-role/department cache rejection |
| Cache ownership and offline recovery | Passed: own offline cache works; other-account, other-section and legacy caches never render |
| Chat and navigation regression browser checks | Passed: conversations, drafts, retries, history, responsive navigation and motion |

Browser tests ran headlessly; no desktop control was used. The temporary API was stopped afterwards. No database migration is needed for these fixes. Existing unowned device query caches are intentionally cleared once; evaluation drafts and saved server conversations are not removed.

The shared questionnaire/semester framework, dean-only department management, read-only reports and audited transfers remain as documented in [administrator responsibilities](ADMIN-RESPONSIBILITIES.md). School-provided roster details and approved evaluation dates are still required for real participation. Physical Android testing and simultaneous MySQL request timing were not verified in this pass; passing tests are evidence for the covered flows rather than a guarantee of every possible device or scenario.
