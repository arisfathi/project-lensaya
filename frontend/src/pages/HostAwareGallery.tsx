import NotFound from "./NotFound";
import PublicGallery from "./PublicGallery";
import { isPublicSiteHostCandidate } from "../lib/platform";

export default function HostAwareGallery() {
  return isPublicSiteHostCandidate() ? <PublicGallery /> : <NotFound />;
}
