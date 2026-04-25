import { useEffect, useState } from "react";
import { publicApi } from "../lib/api";
import { normalizePricingContent } from "../lib/pricingContent";

const EMPTY_PRICING_CONTENT = normalizePricingContent({});

export function usePricingContent() {
  const [pricingContent, setPricingContent] = useState(EMPTY_PRICING_CONTENT);

  useEffect(() => {
    let mounted = true;

    const loadPricingContent = async () => {
      try {
        const result = await publicApi.pricingContent();
        if (!mounted) return;
        setPricingContent(normalizePricingContent(result));
      } catch {
        if (!mounted) return;
        setPricingContent(EMPTY_PRICING_CONTENT);
      }
    };

    void loadPricingContent();

    return () => {
      mounted = false;
    };
  }, []);

  return pricingContent;
}
