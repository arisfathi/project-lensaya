import { Suspense, lazy, type ReactNode } from "react";
import { createBrowserRouter } from "react-router-dom";
import { GuestOnlyRoute, RoleProtectedRoute } from "./components/RoleProtectedRoute";
import { PlatformHostBoundary } from "./components/routing/PlatformHostBoundary";
import { PublicHostCanonicalRoute } from "./components/routing/PublicHostCanonicalRoute";
import { LoadingSpinner } from "./components/ui/LoadingSpinner";

const HostAwareHome = lazy(() => import("./pages/HostAwareHome"));
const Signup = lazy(() => import("./pages/Signup"));
const Login = lazy(() => import("./pages/Login"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Pricing = lazy(() => import("./pages/Pricing"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PhotographerPortfolio = lazy(() => import("./pages/PhotographerPortfolio"));
const PublicGallery = lazy(() => import("./pages/PublicGallery"));
const HostAwareGallery = lazy(() => import("./pages/HostAwareGallery"));
const PhotographerDirectory = lazy(() => import("./pages/PhotographerDirectory"));
const DashboardOverview = lazy(() => import("./pages/dashboard/DashboardOverview"));
const DashboardPricing = lazy(() => import("./pages/dashboard/Pricing"));
const Portfolio = lazy(() => import("./pages/dashboard/Portfolio"));
const Services = lazy(() => import("./pages/dashboard/Services"));
const Packages = lazy(() => import("./pages/dashboard/Packages"));
const Availability = lazy(() => import("./pages/dashboard/Availability"));
const Settings = lazy(() => import("./pages/dashboard/Settings"));
const WebsitePreview = lazy(() => import("./pages/dashboard/WebsitePreview"));
const DashboardAnalytics = lazy(() => import("./pages/dashboard/Analytics"));
const DashboardReferrals = lazy(() => import("./pages/dashboard/Referrals"));
const DashboardTransactions = lazy(() => import("./pages/dashboard/Transactions"));
const MockCheckout = lazy(() => import("./pages/dashboard/MockCheckout"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const Photographers = lazy(() => import("./pages/admin/Photographers"));
const Subscriptions = lazy(() => import("./pages/admin/Subscriptions"));
const Revenue = lazy(() => import("./pages/admin/Revenue"));
const Storage = lazy(() => import("./pages/admin/Storage"));
const Moderation = lazy(() => import("./pages/admin/Moderation"));
const AdminReferrals = lazy(() => import("./pages/admin/Referrals"));
const AdminAnalytics = lazy(() => import("./pages/admin/Analytics"));
const SystemLogs = lazy(() => import("./pages/admin/SystemLogs"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));

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
const marketingRoute = (node: ReactNode) => (
  <PlatformHostBoundary target="public">{withSuspense(node)}</PlatformHostBoundary>
);
const publicCanonicalRoute = (targetPath: "/" | "/gallery", node: ReactNode) => (
  <PublicHostCanonicalRoute targetPath={targetPath}>{withSuspense(node)}</PublicHostCanonicalRoute>
);

export const router = createBrowserRouter([
  {
    path: "/",
    element: withSuspense(<HostAwareHome />),
  },
  {
    path: "/signup",
    element: guestRoute(<Signup />),
  },
  {
    path: "/login",
    element: guestRoute(<Login />),
  },
  {
    path: "/forgot-password",
    element: guestRoute(<ForgotPassword />),
  },
  {
    path: "/reset-password",
    element: guestRoute(<ResetPassword />),
  },
  {
    path: "/pricing",
    element: marketingRoute(<Pricing />),
  },
  {
    path: "/photographers",
    element: marketingRoute(<PhotographerDirectory />),
  },
  {
    path: "/p/:username",
    element: publicCanonicalRoute("/", <PhotographerPortfolio />),
  },
  {
    path: "/p/:username/gallery",
    element: publicCanonicalRoute("/gallery", <PublicGallery />),
  },
  {
    path: "/portfolio",
    element: publicCanonicalRoute("/", <PhotographerPortfolio />),
  },
  {
    path: "/gallery",
    element: withSuspense(<HostAwareGallery />),
  },
  {
    path: "/dashboard",
    element: protectedRoute("PHOTOGRAPHER", "app", <DashboardOverview />),
  },
  {
    path: "/dashboard/pricing",
    element: protectedRoute("PHOTOGRAPHER", "app", <DashboardPricing />),
  },
  {
    path: "/dashboard/portfolio",
    element: protectedRoute("PHOTOGRAPHER", "app", <Portfolio />),
  },
  {
    path: "/dashboard/services",
    element: protectedRoute("PHOTOGRAPHER", "app", <Services />),
  },
  {
    path: "/dashboard/packages",
    element: protectedRoute("PHOTOGRAPHER", "app", <Packages />),
  },
  {
    path: "/dashboard/availability",
    element: protectedRoute("PHOTOGRAPHER", "app", <Availability />),
  },
  {
    path: "/dashboard/preview",
    element: protectedRoute("PHOTOGRAPHER", "app", <WebsitePreview />),
  },
  {
    path: "/dashboard/analytics",
    element: protectedRoute("PHOTOGRAPHER", "app", <DashboardAnalytics />),
  },
  {
    path: "/dashboard/settings",
    element: protectedRoute("PHOTOGRAPHER", "app", <Settings />),
  },
  {
    path: "/dashboard/referrals",
    element: protectedRoute("PHOTOGRAPHER", "app", <DashboardReferrals />),
  },
  {
    path: "/dashboard/transactions",
    element: protectedRoute("PHOTOGRAPHER", "app", <DashboardTransactions />),
  },
  {
    path: "/dashboard/billing/mock-checkout",
    element: protectedRoute("PHOTOGRAPHER", "app", <MockCheckout />),
  },
  {
    path: "/admin",
    element: protectedRoute("ADMIN", "admin", <AdminDashboard />),
  },
  {
    path: "/admin/photographers",
    element: protectedRoute("ADMIN", "admin", <Photographers />),
  },
  {
    path: "/admin/subscriptions",
    element: protectedRoute("ADMIN", "admin", <Subscriptions />),
  },
  {
    path: "/admin/revenue",
    element: protectedRoute("ADMIN", "admin", <Revenue />),
  },
  {
    path: "/admin/storage",
    element: protectedRoute("ADMIN", "admin", <Storage />),
  },
  {
    path: "/admin/moderation",
    element: protectedRoute("ADMIN", "admin", <Moderation />),
  },
  {
    path: "/admin/referrals",
    element: protectedRoute("ADMIN", "admin", <AdminReferrals />),
  },
  {
    path: "/admin/analytics",
    element: protectedRoute("ADMIN", "admin", <AdminAnalytics />),
  },
  {
    path: "/admin/logs",
    element: protectedRoute("ADMIN", "admin", <SystemLogs />),
  },
  {
    path: "/admin/settings",
    element: protectedRoute("ADMIN", "admin", <AdminSettings />),
  },
  {
    path: "*",
    element: withSuspense(<NotFound />),
  },
]);
