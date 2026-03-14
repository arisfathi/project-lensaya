import Landing from "./Landing";
import PhotographerPortfolio from "./PhotographerPortfolio";
import { isPublicSiteHostCandidate } from "../lib/platform";

export default function HostAwareHome() {
  return isPublicSiteHostCandidate() ? <PhotographerPortfolio /> : <Landing />;
}
