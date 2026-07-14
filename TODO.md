# Kovarti PM — Pre-Subscriber TODO

Status: 5/7 complete | Last updated: July 13, 2026 | Blocked: #1 needs Stripe setup

---

## 1. Test Full Stripe Subscriber Flow End-to-End — BLOCKED (Stripe not configured)

**Priority:** High | **Type:** Manual verification

### Blocker: Stripe env vars missing from production
No `STRIPE_*` variables exist in `/opt/pm-app/.env`. Before testing, complete these steps:

1. **Get Stripe API keys** — stripe.com → Developers → API keys (use test mode)
2. **Create products/prices** — Consultant Monthly ($25/mo) and Annual ($250/yr), copy `price_...` IDs
3. **Set up webhook** — endpoint `https://pm.kpbc.ca/api/v1/stripe/webhook`, events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`
4. **Add to `/opt/pm-app/.env`:**
   ```
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_PUBLISHABLE_KEY=pk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   STRIPE_PRICE_MONTHLY=price_...
   STRIPE_PRICE_ANNUAL=price_...
   ```
5. Restart the app after adding env vars

### Test Checklist (after Stripe is configured)
1. Register a new test account on pm.kpbc.ca
2. Check email — verify the verification email arrives (not in spam)
3. Click verify link — confirm "Welcome" email arrives
4. Login with the new account
5. Navigate to /pricing — click "Subscribe Now"
6. Confirm Stripe checkout page loads (not a 403 — validates the scope fix)
7. Use Stripe test card `4242 4242 4242 4242` to complete checkout
8. Verify webhook fires — user's `subscriptionStatus` updates to `active`
9. Verify dashboard shows full access (no TrialBanner, no UpgradePrompt)
10. Test cancellation via billing portal

---

## 2. ~~Build Onboarding Flow for New Users~~ — DONE

**Deployed:** July 13, 2026 | **Commit:** ea6d7f6

### Problem
New users land on a dashboard full of zeros with no guidance. The only "create project" CTA is buried on `/projects` (not the dashboard). No first-login detection exists.

### Approach: Welcome modal + dashboard empty-state CTA

**Step 1 — First-login detection**
- Add `lastLoginAt` to the `/auth/login` response (already exists in DB, just not returned to client)
- In `authStore.ts`, track `isFirstLogin` derived from `lastLoginAt === null` (first login) or project count === 0
- Persist a `hasSeenOnboarding` flag in localStorage to avoid re-showing

**Step 2 — Welcome modal** (`src/client/src/components/onboarding/WelcomeModal.tsx`)
- Triggered on first login (or when user has zero projects and hasn't dismissed it)
- Content: "Welcome to Kovarti PM!" with 3 options:
  - "Create a Project" — opens TemplatePicker modal
  - "Import a Schedule" — opens TemplatePicker on "Start from Scratch" with file upload
  - "Explore First" — dismisses modal, lets them browse
- Sets `hasSeenOnboarding = true` in localStorage on any choice

**Step 3 — Dashboard empty-state CTA**
- In `DashboardPM.tsx` ProjectTable empty state (lines 200-208): add a "New Project" button that opens TemplatePicker
- When zero projects, replace the KPI tiles area with a simpler "Get Started" card

**Step 4 — Sidebar hint** (optional)
- Pulse dot on "Projects" nav item when user has zero projects

### Files to modify
- `src/server/routes/core/auth.ts` — include `lastLoginAt` in login response
- `src/client/src/stores/authStore.ts` — add `isFirstLogin` tracking
- `src/client/src/pages/DashboardPM.tsx` — empty-state CTA button
- NEW: `src/client/src/components/onboarding/WelcomeModal.tsx`
- `src/client/src/components/layout/AppLayout.tsx` — render WelcomeModal

---

## 3. ~~Mobile Responsiveness Audit~~ — DONE

**Deployed:** July 13, 2026 | **Commit:** 2e2b055

### Current State
The authenticated app is well-handled — sidebar has off-canvas mobile pattern, BottomNav exists for mobile, AppLayout uses breakpoint-aware layout. The main gaps are on the **public pages**.

### Issues to Fix

**Landing page navbar (HIGH):**
- No hamburger menu — nav links (Pricing, Sign In, Get Started) are always visible in a horizontal flex row
- On narrow viewports they'll compress/overlap
- Fix: Add a mobile hamburger that toggles a dropdown/overlay menu, hide nav links with `hidden md:flex`

**Landing page tooltip (LOW):**
- Feature card popover is `w-[360px]` fixed width — can overflow on narrow desktop
- Not an issue on mobile (hover doesn't apply on touch) but worth clamping with `max-w-[calc(100vw-2rem)]`

**RegisterPage padding inconsistency (LOW):**
- Uses only `px-4` while LoginPage has `px-4 sm:px-6 lg:px-8`
- Fix: Match LoginPage's padding

**Landing page overflow (LOW):**
- No `overflow-x-hidden` on root div — any element that overflows will cause horizontal scroll
- Fix: Add `overflow-x-hidden` to root

### Files to modify
- `src/client/src/pages/LandingPage.tsx` — hamburger menu, overflow, tooltip clamp
- `src/client/src/pages/RegisterPage.tsx` — padding fix

### No issues found in
- LoginPage (well-structured)
- Sidebar/AppLayout (proper off-canvas + BottomNav)
- ProjectDetailPage (responsive grids, table scroll wrappers)
- DashboardPM (responsive grid layouts)

---

## 4. ~~Lighthouse / Core Web Vitals Performance Audit~~ — DONE

**Deployed:** July 13, 2026 | **Commit:** ea6d7f6

### Audit Steps
1. Run Lighthouse on `https://pm.kpbc.ca/` (landing page) and `/dashboard` (authenticated)
2. Record LCP, INP, CLS, FCP, TTFB, Speed Index scores
3. Check bundle size — `npx vite-bundle-visualizer` in client dir

### Likely Optimizations
- **Lazy-load routes**: Dashboard, ProjectDetail, Settings pages should use `React.lazy()` + `Suspense` instead of eager imports in App.tsx
- **Image optimization**: Check if PWA icons are optimized; add `loading="lazy"` to any images
- **Font loading**: Verify Tailwind's font stack doesn't cause FOIT/FOUT
- **GA4 script**: Already `async` — good
- **Preconnect**: Add `<link rel="preconnect">` for `fonts.googleapis.com` and `www.googletagmanager.com`
- **Tree shaking**: Check if lucide-react icons are tree-shaken (they should be with named imports)

### Files likely to modify
- `src/client/src/App.tsx` — lazy-load route components
- `src/client/index.html` — preconnect hints
- `src/client/vite.config.ts` — chunk splitting config if needed

---

## 5. ~~Add In-App Feedback/Support Channel~~ — DONE

**Deployed:** July 13, 2026 | **Commit:** 2e2b055

### Current State
No help/support link exists anywhere in the authenticated app — not in sidebar, TopBar dropdown, BottomNav, or AppLayout footer.

### Approach: Add help link in 3 places

**1. TopBar user dropdown** (`src/client/src/components/layout/TopBar.tsx`, lines 280-293)
- Add a "Help & Support" link between "Profile & Settings" and "Sign Out"
- Links to `mailto:support@kpbc.ca` (simplest) or a `/help` page
- Icon: `HelpCircle` from lucide-react

**2. Sidebar bottom section** (`src/client/src/components/layout/Sidebar.tsx`, ~line 294)
- Add a `HelpCircle` icon link before the user info block
- Follows the collapsed/expanded icon pattern already in use
- Label: "Help" (collapsed: icon only)

**3. BottomNav "More" menu** — already opens sidebar, so sidebar link covers mobile

### Optional: Create a `/help` page
- Simple page with FAQ, contact info, and links to documentation
- Could be a static page or link to external docs
- For MVP, `mailto:support@kpbc.ca` is sufficient

### Files to modify
- `src/client/src/components/layout/TopBar.tsx` — add dropdown item
- `src/client/src/components/layout/Sidebar.tsx` — add nav link

---

## 6. ~~Verify Resend Email Domain (noreply@kpbc.ca)~~ — DONE

**Completed:** July 13, 2026 | SPF updated to `include:amazonses.com`, DKIM + DMARC already configured

### Steps
1. Log into Resend dashboard (resend.com) — check if `kpbc.ca` domain is verified
2. If not verified, add the required DNS records in TMD Hosting cPanel Zone Editor:
   - **SPF**: `v=spf1 include:_spf.resend.com ~all` (or merge with existing SPF)
   - **DKIM**: CNAME record provided by Resend
   - **DMARC**: `v=DMARC1; p=none; rua=mailto:dmarc@kpbc.ca` (start with monitoring)
3. Wait for DNS propagation (usually 5-30 min)
4. Verify in Resend dashboard
5. Send a test email — register a test account and check deliverability:
   - Check inbox delivery (not spam)
   - Check email headers for SPF/DKIM pass

### No code changes — DNS and Resend dashboard config only
### Owner: User (requires Resend dashboard + DNS access)

---

## 7. Create Proper OG Social Sharing Image (1200x630) — PENDING (design)

**Priority:** Low | **Type:** Polish

### Design
- Create a 1200x630px image for social sharing (LinkedIn, Twitter, Slack previews)
- Content: Kovarti PM logo (indigo), tagline "MS Project-grade scheduling — powered by AI", dark or gradient background, clean/professional
- Format: PNG, optimized (<200KB)

### Steps
1. Design the image (Figma, Canva, or code-generated SVG to PNG)
2. Save as `src/client/public/og-image.png`
3. Update `src/client/index.html`:
   - `og:image` — `https://pm.kpbc.ca/og-image.png`
   - `twitter:image` — `https://pm.kpbc.ca/og-image.png`
   - Add `og:image:width` = 1200, `og:image:height` = 630
4. Rebuild and deploy client
5. Test with Twitter Card Validator and Facebook Sharing Debugger

### Owner: Needs design input from user (or generate programmatically)
