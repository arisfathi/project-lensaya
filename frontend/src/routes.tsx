import { Suspense, type ReactNode } from "react";
import { Navigate, createBrowserRouter } from "react-router-dom";
import { GuestOnlyRoute, RoleProtectedRoute } from "./components/RoleProtectedRoute";
import { PlatformHostBoundary } from "./components/routing/PlatformHostBoundary";
import { PublicHostCanonicalRoute } from "./components/routing/PublicHostCanonicalRoute";
import { LoadingSpinner } from "./components/ui/LoadingSpinner";
import { pages } from "./routes.lazy";
import { ROUTES } from "./routes.paths";
import { RootLayout } from "./layouts/RootLayout";
import { PUBLIC_DIRECTORY_ENABLED } from "./lib/marketingFlags";

const routeFallback = (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center">
    <LoadingSpinner label="Loading page..." />
  </div>
);

const withSuspense = (node: ReactNode) => <Suspense fallback={routeFallback}>{node}</Suspense>;
const guestRoute = (node: ReactNode) => (
  <PlatformHostBoundary target="app">
    <GuestOnlyRoute>{withSuspense(node)}</GuestOnlyRoute>
  </PlatformHostBoundary>
);
const protectedRoute = (role: "ADMIN" | "PHOTOGRAPHER", target: "app" | "admin", node: ReactNode) => (
  <PlatformHostBoundary target={target}>
    <RoleProtectedRoute role={role}>{withSuspense(node)}</RoleProtectedRoute>
  </PlatformHostBoundary>
);
const appRoute = (node: ReactNode) => (
  <PlatformHostBoundary target="app">{withSuspense(node)}</PlatformHostBoundary>
);
const marketingRoute = (node: ReactNode) => (
  <PlatformHostBoundary target="public">{withSuspense(node)}</PlatformHostBoundary>
);
const publicCanonicalRoute = (targetPath: "/" | "/gallery", node: ReactNode) => (
  <PublicHostCanonicalRoute targetPath={targetPath}>{withSuspense(node)}</PublicHostCanonicalRoute>
);

export const router = createBrowserRouter([
    {
      path: "/",
      element: <RootLayout />,
      children: [
  {
    path: ROUTES.home,
    element: withSuspense(<pages.HostAwareHome />),
  },
  {
    path: ROUTES.signup,
    element: guestRoute(<pages.Signup />),
  },
  {
    path: ROUTES.login,
    element: guestRoute(<pages.Login />),
  },
  {
    path: ROUTES.verifyEmail,
    element: appRoute(<pages.VerifyEmail />),
  },
  {
    path: ROUTES.forgotPassword,
    element: guestRoute(<pages.ForgotPassword />),
  },
  {
    path: ROUTES.resetPassword,
    element: guestRoute(<pages.ResetPassword />),
  },
  {
    path: ROUTES.pricing,
    element: marketingRoute(<pages.Pricing />),
  },
  {
    path: ROUTES.checkoutSuccess,
    element: protectedRoute("PHOTOGRAPHER", "app", <pages.CheckoutSuccess />),
  },
  {
    path: ROUTES.checkoutCanceled,
    element: protectedRoute("PHOTOGRAPHER", "app", <pages.CheckoutCanceled />),
  },
  {
    path: ROUTES.photographers,
    element: PUBLIC_DIRECTORY_ENABLED
      ? marketingRoute(<pages.PhotographerDirectory />)
      : marketingRoute(<Navigate to={ROUTES.home} replace />),
  },
  {
    path: ROUTES.helpCenter,
    element: marketingRoute(<pages.HelpCenter />),
  },
  {
    path: ROUTES.billingHelp,
    element: marketingRoute(<pages.BillingHelp />),
  },
  {
    path: ROUTES.blog,
    element: marketingRoute(<pages.Blog />),
  },
  {
    path: ROUTES.guides,
    element: marketingRoute(<pages.Guides />),
  },
  {
    path: ROUTES.about,
    element: marketingRoute(<pages.About />),
  },
  {
    path: ROUTES.contact,
    element: marketingRoute(<pages.Contact />),
  },
  {
    path: ROUTES.privacyPolicy,
    element: marketingRoute(<pages.PrivacyPolicy />),
  },
  {
    path: ROUTES.termsOfService,
    element: marketingRoute(<pages.TermsOfService />),
  },
  {
    path: ROUTES.cookiePolicy,
    element: marketingRoute(<pages.CookiePolicy />),
  },
  {
    path: ROUTES.publicPortfolioByUsername,
    element: publicCanonicalRoute("/", <pages.PhotographerPortfolio />),
  },
  {
    path: ROUTES.publicGalleryByUsername,
    element: publicCanonicalRoute("/gallery", <pages.PublicGallery />),
  },
  {
    path: ROUTES.portfolio,
    element: publicCanonicalRoute("/", <pages.PhotographerPortfolio />),
  },
  {
    path: ROUTES.gallery,
    element: withSuspense(<pages.HostAwareGallery />),
  },
  {
    path: ROUTES.dashboard,
    element: protectedRoute("PHOTOGRAPHER", "app", <pages.DashboardOverview />),
  },
  {
    path: ROUTES.dashboardPricing,
    element: protectedRoute("PHOTOGRAPHER", "app", <pages.DashboardPricing />),
  },
  {
    path: ROUTES.dashboardPortfolio,
    element: protectedRoute("PHOTOGRAPHER", "app", <pages.Portfolio />),
  },
  {
    path: ROUTES.dashboardServices,
    element: protectedRoute("PHOTOGRAPHER", "app", <pages.Services />),
  },
  {
    path: ROUTES.dashboardPackages,
    element: protectedRoute("PHOTOGRAPHER", "app", <pages.Packages />),
  },
  {
    path: ROUTES.dashboardPreview,
    element: protectedRoute("PHOTOGRAPHER", "app", <pages.WebsitePreview />),
  },
  {
    path: ROUTES.dashboardTeam,
    element: protectedRoute("PHOTOGRAPHER", "app", <pages.TeamSettings />),
  },
  {
    path: ROUTES.dashboardAvailability,
    element: protectedRoute("PHOTOGRAPHER", "app", <pages.Availability />),
  },
  {
    path: ROUTES.dashboardAnalytics,
    element: protectedRoute("PHOTOGRAPHER", "app", <pages.DashboardAnalytics />),
  },
  {
    path: ROUTES.dashboardSettings,
    element: protectedRoute("PHOTOGRAPHER", "app", <pages.Settings />),
  },
  {
    path: ROUTES.dashboardReferrals,
    element: protectedRoute("PHOTOGRAPHER", "app", <pages.DashboardReferrals />),
  },
  {
    path: ROUTES.dashboardTransactions,
    element: protectedRoute("PHOTOGRAPHER", "app", <pages.DashboardTransactions />),
  },
  {
    path: ROUTES.admin,
    element: protectedRoute("ADMIN", "admin", <pages.AdminDashboard />),
  },
  {
    path: ROUTES.adminPhotographers,
    element: protectedRoute("ADMIN", "admin", <pages.Photographers />),
  },
  {
    path: ROUTES.adminSubscriptions,
    element: protectedRoute("ADMIN", "admin", <pages.Subscriptions />),
  },
  {
    path: ROUTES.adminRevenue,
    element: protectedRoute("ADMIN", "admin", <pages.Revenue />),
  },
  {
    path: ROUTES.adminStorage,
    element: protectedRoute("ADMIN", "admin", <pages.Storage />),
  },
  {
    path: ROUTES.adminModeration,
    element: protectedRoute("ADMIN", "admin", <pages.Moderation />),
  },
  {
    path: ROUTES.adminReferrals,
    element: protectedRoute("ADMIN", "admin", <pages.AdminReferrals />),
  },
  {
    path: ROUTES.adminAnalytics,
    element: protectedRoute("ADMIN", "admin", <pages.AdminAnalytics />),
  },
  {
    path: ROUTES.adminLogs,
    element: protectedRoute("ADMIN", "admin", <pages.SystemLogs />),
  },
  {
    path: ROUTES.adminSettings,
    element: protectedRoute("ADMIN", "admin", <pages.AdminSettings />),
  },
  {
    path: ROUTES.adminContent,
    element: protectedRoute("ADMIN", "admin", <pages.ContentCms />),
  },
  {
    path: ROUTES.notFound,
    element: withSuspense(<pages.NotFound />),
  },
      ],
  },
]);
