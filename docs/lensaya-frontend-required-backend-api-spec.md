# Lensaya Frontend -> Required Backend API Specification

Generated from frontend analysis (`React + Vite + TailwindCSS`).
Base API path: `/api/v1`
Auth modes: `Public` or `JWT` (Admin routes require admin role in JWT claims).

## Standard Response Envelope

```json
{
  "success": true,
  "data": {},
  "error": null
}
```

## API Endpoints

| Module | Endpoint Path | Method | Description | Request Parameters / Body | Response JSON Structure | Auth |
|---|---|---|---|---|---|---|
| Auth | `/auth/signup` | POST | Email signup | `{ fullName, email, password }` | `{ user, accessToken, refreshToken, expiresIn }` | Public |
| Auth | `/auth/login` | POST | Email login | `{ email, password }` | `{ user, accessToken, refreshToken, expiresIn }` | Public |
| Auth | `/auth/google` | POST | Google sign-in/sign-up | `{ idToken }` | `{ user, accessToken, refreshToken, expiresIn }` | Public |
| Auth | `/auth/forgot-password` | POST | Send reset link | `{ email }` | `{ message }` | Public |
| Auth | `/auth/reset-password` | POST | Reset password with token | `{ token, newPassword }` | `{ message }` | Public |
| Auth | `/auth/refresh` | POST | Refresh access token | `{ refreshToken }` | `{ accessToken, expiresIn }` | Public |
| Auth | `/auth/logout` | POST | Revoke session | `{ refreshToken? }` | `{ message }` | JWT |
| Auth | `/auth/me` | GET | Current authenticated user | None | `{ id, role, fullName, email, username, plan, status }` | JWT |
| Public Directory | `/public/photographers/featured` | GET | Landing featured photographers | `?limit&service` | `{ items:[{ username, studioName, category, imageUrl, location }] }` | Public |
| Public Directory | `/public/photographers` | GET | Global directory browse/filter | `?search&location&specialty&page&limit&sort` | `{ items:[...], pagination:{ page, limit, total } }` | Public |
| Public Portfolio | `/public/photographers/:username` | GET | Public profile info | Path `username` | `{ username, studioName, bio, avatarUrl, heroImageUrl, socialLinks, whatsappNumber, phone, themeColor }` | Public |
| Public Portfolio | `/public/photographers/:username/services` | GET | Public services list | Path `username` | `{ services:[{ id, name, emoji, thumbnailUrl, order }] }` | Public |
| Public Portfolio | `/public/photographers/:username/portfolio` | GET | Portfolio images by service | `?serviceId&page&limit` | `{ items:[{ id, imageUrl, serviceId, category, featured, views }], pagination }` | Public |
| Public Portfolio | `/public/photographers/:username/packages` | GET | Public package cards | `?serviceId` | `{ items:[{ id, serviceId, name, price, currency, duration, features[] }] }` | Public |
| Public Portfolio | `/public/photographers/:username/availability` | GET | Public booking availability | `?month=YYYY-MM` | `{ month, days:[{ date, status:'available'|'booked'|'unavailable' }] }` | Public |
| Booking | `/bookings/calendar` | GET | Photographer booked/unavailable calendar | `?month=YYYY-MM` | `{ month, bookedDates:[...], unavailableDates:[...], totals }` | JWT |
| Booking | `/bookings/:bookingId/status` | PATCH | Update booking status | `{ status:'confirmed'|'declined'|'completed' }` | `{ bookingId, status, updatedAt }` | JWT |
| Dashboard | `/dashboard/overview` | GET | Photographer dashboard cards and chart data | `?range=7d|30d` | `{ stats, trafficSeries, categorySeries, quickCounts, usage:{ services, portfolioImages, packagesPerService } }` | JWT |
| Dashboard | `/dashboard/website-summary` | GET | Website summary widget | None | `{ websiteUrl, portfolioCount, serviceCount, packageCount, lastUpdated }` | JWT |
| Users/Profile | `/profile` | GET | Load photographer settings data | None | `{ studioName, bio, email, username, avatarUrl, bannerUrl, socialLinks, themeColor }` | JWT |
| Users/Profile | `/profile` | PATCH | Save profile/settings | `{ studioName, bio, email, socialLinks, themeColor }` | `{ profile }` | JWT |
| Services | `/services` | GET | List services | None | `{ items:[{ id, name, description, emoji, thumbnailUrl, packageCount, order }] }` | JWT |
| Services | `/services` | POST | Create service | `{ name, description, emoji, thumbnailAssetId?, order? }` | `{ service }` | JWT |
| Services | `/services/:serviceId` | PATCH | Update service | `{ name?, description?, emoji?, thumbnailAssetId?, order? }` | `{ service }` | JWT |
| Services | `/services/:serviceId` | DELETE | Delete service | None | `{ deleted:true }` | JWT |
| Packages | `/packages` | GET | List packages | `?serviceId` | `{ items:[{ id, serviceId, name, price, duration, features[], popular }] }` | JWT |
| Packages | `/packages` | POST | Create package | `{ serviceId, name, price, duration, features[], popular? }` | `{ package }` | JWT |
| Packages | `/packages/:packageId` | PATCH | Update package | `{ name?, price?, duration?, features?, popular? }` | `{ package }` | JWT |
| Packages | `/packages/:packageId/duplicate` | POST | Duplicate package | `{ name? }` | `{ package }` | JWT |
| Packages | `/packages/:packageId` | DELETE | Delete package | None | `{ deleted:true }` | JWT |
| Portfolio | `/portfolio/items` | GET | List photographer portfolio items | `?serviceId&category&featured&page&limit` | `{ items:[{ id, imageUrl, serviceId, category, featured, views, createdAt }], pagination }` | JWT |
| Portfolio | `/portfolio/items` | POST | Add portfolio item | `{ serviceId, category, imageAssetId, featured? }` | `{ item }` | JWT |
| Portfolio | `/portfolio/items/:itemId` | PATCH | Update portfolio item metadata | `{ serviceId?, category?, featured? }` | `{ item }` | JWT |
| Portfolio | `/portfolio/items/:itemId/feature` | PATCH | Feature/unfeature item | `{ featured }` | `{ itemId, featured }` | JWT |
| Portfolio | `/portfolio/items/:itemId` | DELETE | Remove portfolio item | None | `{ deleted:true }` | JWT |
| Availability | `/availability` | GET | Availability month view | `?month=YYYY-MM` | `{ month, days:[{ date, status }] }` | JWT |
| Availability | `/availability` | PATCH | Bulk update availability | `{ updates:[{ date, status }] }` | `{ month, updatedCount }` | JWT |
| Analytics | `/analytics/overview` | GET | Photographer analytics summary | `?range&serviceId?` | `{ stats, trafficSeries, categorySeries, sourceBreakdown }` | JWT |
| Analytics | `/analytics/activity` | GET | Recent activity table data | `?range&page&limit` | `{ items:[{ at, action, portfolio, source }], pagination }` | JWT |
| Analytics | `/analytics/events` | POST | Track visitor events | `{ eventType, photographerUsername, serviceId?, packageId?, source?, sessionId, metadata? }` | `{ eventId, accepted:true }` | Public |
| Uploads | `/uploads/presign` | POST | Generate signed upload URL | `{ fileName, mimeType, size, purpose:'portfolio'|'avatar'|'banner' }` | `{ assetId, uploadUrl, publicUrl, headers }` | JWT |
| Uploads | `/uploads/complete` | POST | Confirm upload completed | `{ assetId }` | `{ assetId, status:'ready', url }` | JWT |
| Uploads | `/uploads/:assetId` | DELETE | Delete uploaded asset | Path `assetId` | `{ deleted:true }` | JWT |
| Billing/Payments | `/billing/plans` | GET | Public plan catalog | None | `{ plans:[{ id, name, price, interval, packageLimitScope:'per_service', limits:{ portfolioPhotos, services, packagesPerService, customDomain, analyticsTools } }] }` | Public |
| Billing/Payments | `/billing/subscription` | GET | Current user subscription and usage | None | `{ plan, status, renewAt, usage }` | JWT |
| Billing/Payments | `/billing/change-plan` | POST | Canonical plan change endpoint; upgrades may return checkout details when required | `{ targetPlanId, billingCycle, successUrl, cancelUrl, referralCode?, forceCheckout? }` | `{ action, changeType?, checkoutUrl?, sessionId?, plan?, status?, pendingChange? }` | JWT |
| Billing/Payments | `/billing/portal-session` | POST | Open billing/customer portal | `{ returnUrl }` | `{ portalUrl }` | JWT |
| Billing/Payments | `/billing/transactions` | GET | User transaction history | `?page&limit&status` | `{ items:[{ id, amount, currency, status, createdAt }], pagination }` | JWT |
| Billing/Payments | `/webhooks/payments` | POST | Payment provider webhook receiver | Provider payload | `{ received:true }` | Public (signature-verified) |
| Referrals | `/referrals/me` | GET | Referral summary for photographer | None | `{ code, totalReferrals, conversions, rewardEarned }` | JWT |
| Referrals | `/referrals/me/events` | GET | Referral event history | `?page&limit` | `{ items:[{ referredUser, status, reward, createdAt }], pagination }` | JWT |
| Referrals | `/public/referrals/track` | POST | Track referral attribution | `{ referralCode, visitorId }` | `{ tracked:true }` | Public |
| Notifications | `/notifications` | GET | Notification bell list | `?unreadOnly&page&limit` | `{ items:[{ id, type, title, body, read, createdAt }], unreadCount }` | JWT |
| Notifications | `/notifications/read` | POST | Mark one or all notifications as read | `{ id }` or `{ all:true }` | `{ id?, read:true, markedCount }` | JWT |
| Admin Dashboard | `/admin/dashboard/overview` | GET | Platform KPIs + charts + recent photographers | `?range` | `{ stats, growthSeries, planDistribution, uploadsSeries, revenueSeries, recentPhotographers }` | JWT (Admin) |
| Admin Photographers | `/admin/photographers` | GET | Search/filter photographers | `?search&plan&status&page&limit` | `{ items:[...], pagination, countsByPlan }` | JWT (Admin) |
| Admin Photographers | `/admin/photographers/:id` | GET | Photographer detail | Path `id` | `{ photographer, subscription, storage, activity }` | JWT (Admin) |
| Admin Photographers | `/admin/photographers/:id/status` | PATCH | Suspend/activate account | `{ status:'active'|'suspended', reason? }` | `{ id, status }` | JWT (Admin) |
| Admin Photographers | `/admin/photographers/export` | GET | Export users | `?plan&status&from&to` | `CSV file` or `{ downloadUrl }` | JWT (Admin) |
| Admin Subscriptions | `/admin/subscriptions/overview` | GET | Subscription stats + plan distribution | `?range` | `{ planStats, distribution, upgradesDowngrades }` | JWT (Admin) |
| Admin Subscriptions | `/admin/subscriptions/plan-limits` | GET | Get editable plan limits | None | `{ free, pro, studio }` | JWT (Admin) |
| Admin Subscriptions | `/admin/subscriptions/plan-limits` | PATCH | Save plan limits | `{ free?, pro?, studio? }` | `{ updated:true, limits }` | JWT (Admin) |
| Admin Subscriptions | `/admin/subscriptions/changes` | GET | Recent upgrades/downgrades | `?page&limit` | `{ items:[{ user, from, to, action, at }], pagination }` | JWT (Admin) |
| Admin Revenue | `/admin/revenue/overview` | GET | Revenue KPI cards | `?range` | `{ mrr, successRate, ytdRevenue, activeSubscriptions }` | JWT (Admin) |
| Admin Revenue | `/admin/revenue/monthly` | GET | Monthly revenue chart data | `?from&to` | `{ series:[{ month, revenue }] }` | JWT (Admin) |
| Admin Revenue | `/admin/revenue/by-plan` | GET | Revenue by plan | `?range` | `{ items:[{ plan, revenue }] }` | JWT (Admin) |
| Admin Revenue | `/admin/revenue/transactions` | GET | Transaction table | `?status&page&limit` | `{ items:[{ id, photographer, plan, amount, status, date }], pagination }` | JWT (Admin) |
| Admin Storage | `/admin/storage/overview` | GET | Storage KPIs | `?range` | `{ totalStorage, totalImages, avgPerUser, monthlyGrowth }` | JWT (Admin) |
| Admin Storage | `/admin/storage/by-plan` | GET | Storage distribution by plan | None | `{ items:[{ plan, usage }] }` | JWT (Admin) |
| Admin Storage | `/admin/storage/uploads` | GET | Upload trend series | `?from&to` | `{ series:[{ month, uploads }] }` | JWT (Admin) |
| Admin Storage | `/admin/storage/top-users` | GET | Top storage users | `?page&limit` | `{ items:[{ userId, name, plan, storageUsed, imageCount, quotaPercent }], pagination }` | JWT (Admin) |
| Admin Moderation | `/admin/moderation/overview` | GET | Moderation KPIs + abuse types | `?range` | `{ stats, abuseTypes }` | JWT (Admin) |
| Admin Moderation | `/admin/moderation/reports` | GET | Report queue | `?status&severity&page&limit` | `{ items:[{ reportId, photographer, reports, reason, severity, status }], pagination }` | JWT (Admin) |
| Admin Moderation | `/admin/moderation/reports/:reportId` | PATCH | Approve/suspend/escalate report | `{ action:'approve'|'suspend'|'escalate', note? }` | `{ reportId, status, action }` | JWT (Admin) |
| Admin Moderation | `/admin/moderation/flagged-images` | GET | Flagged image queue | `?status&page&limit` | `{ items:[{ imageReportId, photographer, reason, reports, date, imageUrl }] }` | JWT (Admin) |
| Admin Moderation | `/admin/moderation/flagged-images/:imageReportId` | PATCH | Approve/remove image | `{ action:'approve'|'remove', note? }` | `{ imageReportId, status }` | JWT (Admin) |
| Admin Referrals | `/admin/referrals/overview` | GET | Referral KPIs + growth chart | `?range` | `{ stats, growthSeries }` | JWT (Admin) |
| Admin Referrals | `/admin/referrals/top-referrers` | GET | Top referrers table | `?page&limit` | `{ items:[{ userId, referrals, conversions, conversionRate, rewardEarned }] }` | JWT (Admin) |
| Admin Analytics | `/admin/analytics/overview` | GET | Platform analytics and engagement | `?range` | `{ trafficSeries, sourceBreakdown, portfolioViewsSeries, engagementMetrics }` | JWT (Admin) |
| Admin Logs | `/admin/system-logs` | GET | Search/filter system logs | `?q&eventType&range&page&limit` | `{ items:[{ id, timestamp, event, user, ip, status, details }], pagination }` | JWT (Admin) |
| Admin Settings | `/admin/settings` | GET | Load admin settings | None | `{ planLimits, emailNotifications, legalPagesMeta }` | JWT (Admin) |
| Admin Settings | `/admin/settings/email-notifications` | PATCH | Save notification toggles | `{ newSignup, subscription, abuse, dailyReport, weeklyReport }` | `{ saved:true }` | JWT (Admin) |
| Admin Settings | `/admin/settings/plan-limits` | PATCH | Save limits | `{ free, pro, studio }` | `{ saved:true, limits }` | JWT (Admin) |
| Legal | `/admin/legal-pages` | GET | List legal pages | None | `{ items:[{ slug, title, updatedAt }] }` | JWT (Admin) |
| Legal | `/admin/legal-pages/:slug` | PATCH | Update legal content | `{ title?, content }` | `{ slug, updatedAt }` | JWT (Admin) |

## Detected File/Image Upload Requirements

1. Portfolio photo uploads from dashboard portfolio page.
2. Profile avatar upload from settings page.
3. Banner image upload from settings page.
4. Storage analytics and lifecycle tracking for uploaded assets.

## Detected Payment Flows

1. User clicks upgrade in dashboard/settings.
2. Frontend calls the canonical `POST /billing/change-plan` endpoint.
3. User completes provider checkout.
4. Provider webhook updates subscription/payment state.
5. Frontend reloads subscription status and transaction history.
6. Admin revenue/subscription dashboards consume these records.

## Detected Analytics Tracking Requirements

Suggested tracked event types:

1. `portfolio_view`
2. `profile_click`
3. `whatsapp_click`
4. `booking_intent`
5. `service_select`
6. `package_select`

Track ingestion endpoint: `POST /analytics/events`.

## Detected Email Trigger Requirements

1. Welcome/verification email on signup.
2. Password reset email.
3. Booking/inquiry notification to photographer (and optionally client).
4. Payment receipt/failure notifications.
5. Moderation/security alert notifications.
6. Admin periodic digest (daily/weekly reports).
