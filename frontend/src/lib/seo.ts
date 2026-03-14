import { useEffect } from "react";

type SeoMetaInput = {
  title: string;
  description?: string | null;
  image?: string | null;
  canonicalUrl?: string | null;
  type?: string;
  robots?: string;
};

const upsertMetaTag = (key: "name" | "property", value: string, content: string | null | undefined) => {
  const selector = `meta[${key}="${value}"]`;
  let element = document.head.querySelector(selector) as HTMLMetaElement | null;
  if (!content) {
    if (element) {
      element.remove();
    }
    return;
  }

  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(key, value);
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
};

const upsertCanonical = (url: string | null | undefined) => {
  let element = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!url) {
    if (element) {
      element.remove();
    }
    return;
  }

  if (!element) {
    element = document.createElement("link");
    element.setAttribute("rel", "canonical");
    document.head.appendChild(element);
  }
  element.setAttribute("href", url);
};

export const useSeoMeta = ({
  title,
  description,
  image,
  canonicalUrl,
  type = "website",
  robots = "index,follow",
}: SeoMetaInput) => {
  useEffect(() => {
    document.title = title;
    upsertMetaTag("name", "description", description || null);
    upsertMetaTag("name", "robots", robots);

    upsertMetaTag("property", "og:type", type);
    upsertMetaTag("property", "og:title", title);
    upsertMetaTag("property", "og:description", description || null);
    upsertMetaTag("property", "og:image", image || null);
    upsertMetaTag("property", "og:url", canonicalUrl || null);

    upsertMetaTag("name", "twitter:card", image ? "summary_large_image" : "summary");
    upsertMetaTag("name", "twitter:title", title);
    upsertMetaTag("name", "twitter:description", description || null);
    upsertMetaTag("name", "twitter:image", image || null);

    upsertCanonical(canonicalUrl || null);
  }, [canonicalUrl, description, image, robots, title, type]);
};
