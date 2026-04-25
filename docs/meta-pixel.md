# Meta Pixel Integration Guide

Meta Pixel (Facebook Pixel) tracking for Lensaya enables conversion tracking and analytics across the platform. This document describes how Meta Pixel is integrated, which events are tracked, and how to configure it.

## Setting Up Meta Pixel

### 1. Create a Meta Business Account

1. Go to [Meta Business Suite](https://business.facebook.com/)
2. Create an account or log in to your existing Meta Business account
3. Create a Business with your company details

### 2. Create a Pixel

1. In Meta Business Suite, open **Events Manager**
2. Under **Data Sources**, select **Pixels**
3. Click **Create** and give your pixel a name (e.g., "Lensaya Production")
4. Select your website URL and click **Create Pixel**
5. Copy your **Pixel ID** (an 15-16 digit number)

### 3. Configure Lensaya

Add your Pixel ID to the frontend environment:

**frontend/.env** (local development):
```sh
VITE_META_PIXEL_ID=YOUR_15_DIGIT_PIXEL_ID
```

**Production environment variables**:
Set `VITE_META_PIXEL_ID` in your deployment environment (vercel, netlify, docker, etc.) to the production Pixel ID.

### 4. Verify Installation

1. Start Lensaya: `npm run dev`
2. Open the app in your browser
3. Open DevTools Console
4. You should see: `[Meta Pixel] Development mode - tracking disabled`
5. To test in production mode, visit your deployed site

To verify production tracking:
1. Install the [**Meta Pixel Helper**](https://chrome.google.com/webstore/detail/meta-pixel-helper/) browser extension
2. Visit any public page on your app
3. The extension should show that Meta Pixel is installed and tracking

## Development Mode

In development mode (`VITE_MODE=development`), Meta Pixel tracking is **disabled** and console logs are printed instead:

```
[Meta Pixel] Event: PageView
[Meta Pixel] Event: CompleteRegistration { email: '...', referral_source: '...' }
[Meta Pixel] Event: Login { email: '...' }
```

This prevents polluting your pixel with dev/test data. To enable tracking in development, set:
```sh
VITE_MODE=production
```
(not recommended unless you're testing)

## Tracked Events

### Automatic Events

#### PageView
Tracked automatically on all **public pages**:
- Public home `/`
- Pricing `/pricing`
- Photographer directory `/photographers`
- Help center `/help-center`
- Blog `/blog`
- Guides `/guides`
- About `/about`
- Contact `/contact`
- Public portfolio `/:username`
- Public gallery `/:username/gallery`

**Not tracked on**:
- Dashboard pages (photographer-only)
- Admin pages (admin-only)
- Auth pages (signup, login) - tracked as specific events instead

### Custom Events

#### CompleteRegistration
Triggered when a user successfully creates an account (via email or Google OAuth).

**Data**:
- `email`: User's email address
- `referral_source`: Referral code (if any)

**Where tracked**:
- [frontend/src/pages/Signup.tsx](../frontend/src/pages/Signup.tsx) (email signup)
- [frontend/src/pages/Signup.tsx](../frontend/src/pages/Signup.tsx) (Google OAuth)

#### Login
Triggered when a user successfully logs in (via email or Google OAuth).

**Data**:
- `email`: User's email address

**Where tracked**:
- [frontend/src/pages/Login.tsx](../frontend/src/pages/Login.tsx) (email login)
- [frontend/src/pages/Login.tsx](../frontend/src/pages/Login.tsx) (Google OAuth)

#### Lead (Optional)
Can be tracked on newsletter signup or other email captures. Currently not implemented.

**Usage**:
```typescript
import { trackLead } from "../lib/metaPixel";

trackLead({
  email: "user@example.com",
  lead_type: "newsletter"
});
```

#### Purchase (Backend)
Should be tracked from the backend when a subscription is created/confirmed.

**Where to implement**:
- In backend billing webhook handlers (`stripeBilling.test.js`)
- Add pixel HTML to receipt emails

**Example** (in backend email template):
```html
<img src="https://www.facebook.com/tr?id=YOUR_PIXEL_ID&ev=Purchase&cd[value]=99.99&cd[currency]=USD" 
     alt="" width="1" height="1" />
```

## User Identification

### External User ID

When a user logs in or signs up, their user ID is sent to Meta Pixel for cross-domain tracking:

```typescript
import { setExternalUserID } from "../lib/metaPixel";

// After successful login/signup
setExternalUserID(user.id);
```

This allows Meta to match users across different devices and browsers.

### User Data Clearance

On logout, user data is cleared from Meta Pixel:

```typescript
import { clearUserData } from "../lib/metaPixel";

// On logout
clearUserData();
```

See [frontend/src/contexts/AuthContext.tsx](../frontend/src/contexts/AuthContext.tsx) for implementation.

## API Reference

### `initializeMetaPixel()`

Initializes the Meta Pixel script. Called automatically on app start from [frontend/src/main.tsx](../frontend/src/main.tsx).

Important: this only initializes `fbq` and does not directly fire `PageView`; SPA route tracking is the single source of truth for `PageView` events.

```typescript
import { initializeMetaPixel } from "../lib/metaPixel";

initializeMetaPixel();
```

### `trackPageView(path?: string)`

Track a page view event. Called automatically by the router on route changes.

Current behavior: tracks only public/marketing routes and excludes admin, dashboard, and auth routes.

```typescript
import { trackPageView } from "../lib/metaPixel";

trackPageView("/pricing");
```

### `trackSignUp(data?: Object)`

Track account signup completion. This helper fires Meta's standard `CompleteRegistration` event.

```typescript
import { trackSignUp } from "../lib/metaPixel";

trackSignUp({
  email: "user@example.com",
  referral_source: "ref_abc123"
});
```

### `trackLogin(data?: Object)`

Track successful login.

```typescript
import { trackLogin } from "../lib/metaPixel";

trackLogin({ email: "user@example.com" });
```

### `trackLead(data?: Object)`

Track a lead/email capture.

```typescript
import { trackLead } from "../lib/metaPixel";

trackLead({
  email: "user@example.com",
  lead_type: "newsletter"
});
```

### `trackPurchase(data?: Object)`

Track a purchase/subscription.

```typescript
import { trackPurchase } from "../lib/metaPixel";

trackPurchase({
  currency: "USD",
  value: 99.99,
  content_name: "Monthly Photography Plan",
  content_type: "subscription"
});
```

### `setExternalUserID(userId: string)`

Set the user's ID for cross-domain tracking.

```typescript
import { setExternalUserID } from "../lib/metaPixel";

setExternalUserID("user_123abc");
```

### `clearUserData()`

Clear user data (called on logout).

```typescript
import { clearUserData } from "../lib/metaPixel";

clearUserData();
```

## Implementation Details

### Event Deduplication

To prevent duplicate tracking (e.g., same event fired twice in 1 second), events are deduplicated within a 1-second window. If the same event + data is fired twice, the second is ignored:

```typescript
// First call - tracked
trackPageView("/pricing");

// Second call (within 1 second) - deduplicated
trackPageView("/pricing"); // Ignored - duplicate
```

### Development Safety

The Meta Pixel library checks for development mode and disables tracking automatically:

```typescript
if (IS_DEVELOPMENT) {
  console.log(`[Meta Pixel] Event: ${eventName}`);
  return;
}
```

This prevents polluting your pixel with dev/test data.

### Script Injection

The Meta Pixel script is injected dynamically from `https://connect.facebook.net/en_US/fbevents.js` on initialization.

### SPA PageView Source

`PageView` is emitted by the route hook in [frontend/src/hooks/useMetaPixelPageView.ts](../frontend/src/hooks/useMetaPixelPageView.ts), not during pixel initialization, to avoid duplicate first-load events in SPA navigation.

## Testing

## Production Rollout Checklist

Use this checklist before enabling campaigns that depend on Meta Pixel conversions.

- Environment variable:
  - Ensure `VITE_META_PIXEL_ID` is set to the production Pixel ID in the frontend deployment environment.
- Deployment:
  - Deploy frontend with the new environment value.
  - Hard refresh the site after deploy to load the latest bundle and pixel config.
- Meta Test Events:
  - Open Events Manager -> Test Events for the production Pixel.
  - Visit public pages and verify `PageView` arrives with changing `page_path` values.
  - Complete a new signup flow and verify `CompleteRegistration`.
  - Complete a login flow and verify `Login`.
- Pixel Helper:
  - Open the site with Meta Pixel Helper enabled.
  - Confirm one pixel is detected and events fire on navigation.
  - Confirm no warnings about missing pixel ID or malformed events.
- Expected events right now:
  - `PageView` on public and marketing pages.
  - `CompleteRegistration` on successful signup (email and Google).
  - `Login` on successful login (email and Google).
  - `Lead` only if explicitly instrumented in a separate change.
  - `Purchase` is intentionally not fired yet.
- What should not be tracked in this phase:
  - No `PageView` for `/dashboard*` routes.
  - No `PageView` for `/admin*` routes.
  - No `PageView` for auth routes: `/signup`, `/login`, `/verify-email`, `/forgot-password`, `/reset-password`.
- Duplicate-fire checks:
  - First page load should emit a single `PageView` from route tracking.
  - Reloading the same URL should not produce immediate duplicate event spam.
  - Route changes should emit one `PageView` per navigation, not an init + route double fire.

Purchase rollout note:
- Keep `Purchase` unwired for now.
- Frontend checkout return pages (`/checkout/success`) are not the most reliable paid confirmation source because provider redirects can occur before final paid settlement in webhook-driven flows.
- Recommended next step is wiring `Purchase` from webhook-confirmed paid transitions once that confirmation is exposed through a stable, deduplicated surface.

### Unit Testing

For component tests, Meta Pixel functions return early with no side effects when `VITE_MODE` is not production. To test tracking without a real Pixel ID:

```typescript
import { vi } from "vitest";
import * as metaPixel from "../lib/metaPixel";

vi.mock("../lib/metaPixel", () => ({
  trackPageView: vi.fn(),
  trackSignUp: vi.fn(),
  trackLogin: vi.fn(),
  // ... etc
}));

test("tracks signup", async () => {
  const { trackSignUp } = await import("../lib/metaPixel");
  // ... user signs up ...
  expect(trackSignUp).toHaveBeenCalledWith({
    email: "user@example.com"
  });
});
```

### Manual Testing

1. Install the [Meta Pixel Helper](https://chrome.google.com/webstore/detail/meta-pixel-helper/)
2. Visit your production site
3. Open the extension (top right of your browser)
4. Perform actions (click signup, login, visit pages)
5. The extension should show all tracked events in real-time

### Testing Without Pixel ID

In development, the library safely returns without tracking if no Pixel ID is set. This is intentional to avoid test data pollution.

## Troubleshooting

### Events Not Appearing in Meta

**Problem**: Events are tracked (shown in browser console) but not appearing in Meta Events Manager.

**Causes**:
1. Wrong Pixel ID (check`VITE_META_PIXEL_ID` matches what's in Meta Business Suite)
2. Site not verified in Meta Business Suite (setup can take 24 hours)
3. Using development Pixel in development mode (expected - tracking is disabled)
4. Browser extensions blocking Meta Pixel script

**Solution**:
- Verify Pixel ID matches exactly (no extra spaces)
- Use a production pixel for production testing
- Install [Meta Pixel Helper](https://chrome.google.com/webstore/detail/meta-pixel-helper/) to verify script is loading
- Test on a fresh browser without ad blockers

### Pixel ID Not Set

**Problem**: Console shows `[Meta Pixel] Pixel ID not configured`.

**Cause**: `VITE_META_PIXEL_ID` is not set.

**Solution**:
1. Create a Pixel in Meta Business Suite (see "Setting Up Meta Pixel" above)
2. Add `VITE_META_PIXEL_ID=YOUR_ID` to frontend `.env`
3. Restart dev server: `npm run dev`

### Development Mode Confusing Tracking

**Problem**: Tracking is "disabled" in dev mode, but you want to test.

**Solution**:
Set `VITE_MODE=production` in frontend `.env` to enable tracking in dev (not recommended for long-term dev):

```sh
VITE_MODE=production
```

Or better - test on your production deployment using Meta Pixel Helper.

## See Also

- [Meta Pixel Documentation](https://developers.facebook.com/docs/meta-pixel)
- [Meta Events Manager](https://www.facebook.com/ads/manager/pixel/)
- [Facebook Conversions API](https://developers.facebook.com/docs/marketing-api/conversions-api) (for server-side tracking)
- [SECURITY.md](./SECURITY.md) - Privacy and data handling practices
