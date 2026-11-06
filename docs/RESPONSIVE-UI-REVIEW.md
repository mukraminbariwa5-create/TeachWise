# Responsive UI review — 6 November 2026

The same account must retain its navigation destinations, readable identity and Professor Wise artwork when moving between phone, tablet and desktop layouts.

## Changes

- The school-admin and dean phone headers include the brand mark and an **Open navigation** button. Their full-height left drawer exposes the role's existing destinations and Settings. Account, Profile and Help are reached through the existing account screens rather than duplicated in the drawer. Students and teachers use bottom tabs and Account without a hamburger. Desktop/tablet retain the permanent compact rail.
- The mobile menu closes after selection and when crossing a layout breakpoint. Only the current destination is highlighted and marked with `aria-current` on the web.
- Phone dashboard and profile illustrations are 112 pixels high, with a 104-pixel student greeting illustration and a 42-pixel face inside the enlarged 68-pixel Ask Wise button. Profile cards place the mascot beside the avatar, with the full name and credentials below, avoiding overlapping text and allowing long managing-office names to wrap.
- Chat and bottom-tab mascot sizes account for the stickers' actual aspect ratios so the face fits within its circular frame.

## Initial responsive verification

Headless Edge browser checks used normal demo API reads for the screen sweep and isolated API fixtures for form submissions. No real evaluation or registration was submitted.

- **139 checks passed:** student, teacher, school administrator, dean and platform-owner routes at 320, 768 and 1366 pixels; includes one teacher-report print export. Runtime errors, API failures, viewport overflow, phone menu navigation and profile-mascot asset loading were checked.
- **60 checks passed:** home/profile across all five account types at 390, 600, 767, 820, 1024 and 1920 pixels.
- **30 checks passed:** home/profile at tablet/desktop sizes and 390-pixel dark mode with Filipino labels for all five account types.
- Short-screen navigation regression passed at 320 × 568: scroll to Help and Settings, dismiss after selection, phone/tablet/phone resize cleanup, one current-page marker, and chat composer inside the viewport.
- Isolated evaluation flow passed at 320, 390 and 820 pixels: ratings, review, submission, draft restoration, chat/history/notification/account navigation, empty/closed/upcoming periods and dark mode.
- Small-phone audit passed for long class/report/notification text, sign-in validation, registration steps, password visibility, recovery dialog and preservation of entered values after a failed registration.
- School-admin/dean responsibility checks passed, including editing a long managing-office name with the restored profile mascot.
- TypeScript and whitespace checks on the changed files passed. Screenshots of phone profiles, mobile menus and dark-mode dashboards were inspected.

Artifacts are under ignored `.ui-checks/responsive-review`, `.ui-checks/responsive-breakpoints`, `.ui-checks/responsive-theme-language` and `.ui-checks/admin-responsibilities`. This verifies responsive browser layouts; it does not represent a physical Android/iOS device test.

## Left-drawer follow-up

The mobile hamburger and drawer are restricted to school administrators and deans (`role: admin`). Students, teachers and the platform owner use their existing bottom navigation and Account screens; their desktop/tablet rail remains available.

The navigation now slides horizontally from the left, capped at 320 pixels and leaving at least 40 pixels of tappable backdrop. The drawer scrolls independently, supports outside-tap and Escape dismissal, respects safe-area insets and reduced motion, and closes when crossing the phone/tablet breakpoint. Bottom sheets remain for forms and quick actions. The mobile account/profile/help destinations remain accessible from the avatar and bottom navigation. Ask Wise is also omitted from the drawer and remains on the central bottom tab.

The short-phone regression checks verify left/top/full-height geometry, absent duplicate links, selection, backdrop dismissal, normal animation, Escape dismissal, resize cleanup and the visible chat composer. Updated screenshots are in `.ui-checks/left-drawer-review`.

Follow-up results: 71 browser checks passed for home/profile/chat across all five account types at 320, 390, 767, 768 and 1366 pixels (including one report print check); 10 passed in 390-pixel dark mode with Filipino labels; four passed for school-admin/dean home/profile at 320 × 568, including scrolling to the final Settings destination. TypeScript and script syntax checks passed. Phone home, profile and left-drawer screenshots were visually inspected.
