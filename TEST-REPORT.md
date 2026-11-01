# PulseFit — Pre-deployment Test Report

**Date:** 25 October 2026 · **Run all tests:** `npm run test:all`

## Summary

| Suite | Command | Total | Passed | Failed | Skipped |
|---|---|---:|---:|---:|---:|
| Backend + unit (Vitest + Supertest) | `npm run test` | 152 | 152 | 0 | 0 |
| Browser end-to-end (Playwright, desktop Chrome + iPhone-size) | `npm run test:e2e` | 66 | 65 | 0 | 1 |
| **Total** | `npm run test:all` | **218** | **217** | **0** | **1** |

The one skipped test is intentional: the "no sideways scrolling at 375px" check runs on the phone profile only, so its desktop copy is skipped.

Production build (`npm run build`): **completes with 0 errors and 0 warnings.**

### Lighthouse (production build)

| Page | Device | Performance | Accessibility | Best Practices | SEO |
|---|---|---|---|---|---|
| Landing | Mobile | 84 → **93** | 100 → **100** | 100 → **100** | 91 → **100** |
| Landing | Desktop | 96 → **99** | 100 → **100** | 100 → **100** | 91 → **100** |
| Login | Mobile | 84 → **99** | 100 → **100** | 100 → **100** | 91 → **100** |
| Login | Desktop | 96 → **100** | 100 → **100** | 100 → **100** | 91 → **100** |

On mobile, the landing page's first content now appears in 1.7 s (was 3.2 s). The main content appears in 3.1 s (was 3.5 s). Everything is now at 90 or above.

---

## What is tested

**Test data never touches real data.**
- Backend tests run against their own throwaway in-memory database.
- Browser tests start their own separate servers on ports 5174/3101, with another throwaway in-memory database.
- Every test user has a unique `…@pulsefit.test` email. Backend tests delete their users at the end; the browser-test database disappears when the run ends.

### Backend / API (72 tests)
- **Sign up:**
  - Works.
  - Blocks a duplicate email, whatever its letter case.
  - Blocks empty, short, letters-only, numbers-only and over-long passwords.
  - Rejects a missing name, a bad email, out-of-range goals and malformed JSON.
  - Stores the password hashed with bcrypt.
- **Login and logout:**
  - Login works, and the email is case-insensitive.
  - A wrong password and an unknown email get the same message.
  - Logout clears the cookie, and the old session stops working.
- **`/api/auth/me`:** returns the user when logged in. Returns 401 when logged out, for a forged cookie, and for a deleted account.
- **`/api/stats`:** returns whole numbers, and counts only completed workouts.
- **`/api/exercises`:** returns all 30, the "All" filter works, each of the 6 muscle-group filters returns exactly 5, and an unknown group is rejected.
- **Workout lifecycle:**
  - Adding the first exercise creates today's workout, and the second exercise joins the same workout.
  - Duplicate, invalid and unknown exercises are refused.
  - Start, restart, and "mark all sets done" work.
  - Ticking and unticking a set work.
  - Finishing saves the duration, and finishing twice is harmless.
  - A finished workout is locked.
  - Adding an exercise after finishing starts a new workout.
- **Security:** user B cannot see, tick, untick, start, restart or finish user A's workout or sets, and A's data stays untouched.
- **Protected routes:** all 6 return 401 without login.

### Streak and stats logic, using fake dates (12 tests)
- No workouts gives a streak of 0.
- 3 days in a row gives 3.
- A missed day resets the streak, but the best streak is remembered.
- Today plus yesterday gives 2.
- Yesterday-only keeps the streak alive.
- Two workouts on one day count once.
- Unfinished workouts don't count.
- Future dates are ignored.
- The server's own clock is used when no date is sent.
- The 7-day chart has exactly 7 days with the right minutes per day.
- The rings count Monday to today and work out "goals hit" correctly.
- A brand-new user gets zeros, never NaN.

### Unit tests (80 tests)
- **Progress rings:** never above 100%, and never NaN, even for a goal of 0, missing values or nonsense values.
- **Request helpers:** handle malformed JSON (including how Vercel behaves), date and ID validation, and cookie parsing.
- **Encoding guard:** every source file is checked for garbled characters (see bug 5).

### Browser tests (33 per device × 2 devices)
- **Landing:** "PulseFit" appears in the navbar, hero, footer and tab title. The headline is correct. The counters visibly count up to the real database numbers. "Start Your Workout" goes to sign-up when you're logged out.
- **Full journey:**
  1. Sign up from the landing page and land on the Dashboard, with the empty state and your name in the navbar.
  2. Add 2 exercises from the Library.
  3. The Dashboard shows the workout; click Start.
  4. The rest timer starts at the exercise's rest time and counts down.
  5. Tick every set; the workout finishes and confetti appears.
  6. The Dashboard shows the streak, the chart bar, and ring numbers that match the database.
  7. After a refresh, the data is still there.
  8. After logout, Dashboard, Library, Live and Profile all redirect to Login.
  9. Logging back in returns you to the page you wanted.
- **Library:** "All" shows 30. Each of the 6 muscle-group filters shows exactly its 5 cards. The no-results empty state works.
- **Quality:**
  - Every page, in dark and light mode, has no browser console errors or warnings and passes automated WCAG 2.1 AA accessibility checks (axe). These cover colour contrast, button names, image text and form labels.
  - No page scrolls sideways at 375px.
  - Every button has a readable name.
  - Sign-up and the Library work with the keyboard alone, and the focus outline is visible.

---

## Bugs found and fixed

| # | Bug | How it was found | Fix |
|---|---|---|---|
| 1 | Weak passwords such as `password` or `12345678` were accepted at sign-up | API test | Passwords now need 8+ characters including a letter and a number, checked on the server and in the form |
| 2 | `/api/auth/me` answered 200 instead of 401 when logged out | API test | Now returns 401. A small companion cookie lets the app skip that check for visitors who never logged in, so they see no console errors |
| 3 | Logging out from a logged-in page landed on Login instead of the home page | Browser test | Two navigations raced each other. Logout now moves to the home page first |
| 4 | "Take me back where I was going" after login didn't work: you always landed on the Dashboard | Browser test | Two redirects competed after login. There is now a single redirect in charge |
| 5 | Garbled characters (`â€™`, broken emojis) in the quote of the day, the class emojis and the login/sign-up messages | Found while fixing tests | An editing step had saved two files with the wrong text encoding. Both were repaired byte-for-byte, and a test now fails if this ever happens again |
| 6 | Progress rings could receive NaN (for example a goal of 0) and draw incorrectly | Unit test | One shared helper now keeps every ring between 0% and 100% and turns NaN into 0 |
| 7 | Login and Sign-up pages scrolled sideways on 375px phones | Browser test | The decorative glow behind the card is clipped at the screen edge (no visual change) |
| 8 | On phones, the sticky top bars or bottom nav could cover a button that was scrolled or tabbed to | Browser test (mobile) | Added scroll padding so focused controls always stay visible |
| 9 | After changing screen, keyboard focus stayed where the old button was, so Tab jumped to the footer | Keyboard test | Focus now moves to the new screen's content on every screen change |
| 10 | Avatar buttons showed "TU" but screen readers announced only "Open profile" | Accessibility test | The visible initials are now part of the spoken name |
| 11 | The show-password button sat inside the field's label (invalid HTML), which gave the password box a confusing spoken name | Code review during testing | Labels are now linked to their inputs, and the button sits next to the field |
| 12 | Grey secondary text fell below the 4.5:1 contrast minimum over the lime glow on phones (dark mode) | Accessibility test | Dark-mode grey is slightly lighter (`#8c96a0` → `#aeb8c2`) |
| 13 | Light mode: coloured text (lime, cyan, orange, gold, violet, grey) was too faint on 8 pages | Accessibility test | Light mode now uses deeper shades of the same colours for text. Dark mode is unchanged |
| 14 | If your session expired while the app was open, screens showed errors instead of sending you to Login | Found while writing tests | Any "not logged in" answer from the server now logs you out and redirects to Login |
| 15 | The landing page downloaded the whole charts library, and React itself had been bundled into it | Lighthouse | Fixed the bundle split, and logged-in screens now load on demand. The landing page loads about 350 KB of JavaScript instead of about 800 KB |
| 16 | Google Fonts blocked the first paint for about 1 s | Lighthouse | Fonts now load without blocking. They look identical once loaded |
| 17 | No `robots.txt` (the app served its HTML page in its place, so SEO scored 91) | Lighthouse | Added `public/robots.txt` |
| 18 | On Vercel, a request with malformed JSON would have returned a generic 500 | Code review during testing | Now a friendly 400, covered by a unit test that simulates Vercel's behaviour |

The design is unchanged apart from the contrast fixes in rows 12 and 13.

---

## Please check by hand

1. **A real iPhone in Safari.** The phone tests use Chrome's engine at iPhone size, not Safari. Check the glass blur, the bottom nav above the home bar, and the confetti.
2. **Light mode.** Text colours there are deeper to pass contrast checks. Make sure you're happy with how they look.
3. **Neon, once connected.** After adding `DATABASE_URL`, run `npm run db:setup`. You can then run the backend tests against Neon too: `$env:TEST_DATABASE_URL="<your Neon URL>"; npm test`. They create and delete their own `vitest+…@pulsefit.test` users only.
4. **Lighthouse covered the public pages only** (landing and login). Logged-in pages are covered by the accessibility and console tests instead. If you want their speed scores, run Lighthouse from Chrome DevTools while logged in.
5. **Around midnight.** "Today" uses your phone's local date. If you can, start a workout just before midnight and finish it just after.
6. **Still demo data:** the Progress page, class booking, and the Profile level/XP/badges.
7. **First login after this update.** Anyone already logged in from before this update will be asked to log in once more, because of the new companion cookie.
