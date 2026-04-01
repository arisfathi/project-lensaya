/**
 * Root layout component for the entire application
 * Includes Meta Pixel tracking and other app-level setup
 */

import { Outlet } from "react-router-dom";
import { MetaPixelTracker } from "../components/MetaPixelTracker";

export function RootLayout() {
  return (
    <>
      <MetaPixelTracker />
      <Outlet />
    </>
  );
}
