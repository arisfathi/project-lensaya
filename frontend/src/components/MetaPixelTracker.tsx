/**
 * Meta Pixel tracking container
 * Tracks PageView events on route changes
 */

import { useMetaPixelPageView } from "../hooks/useMetaPixelPageView";

export function MetaPixelTracker(): null {
  useMetaPixelPageView();
  return null;
}
