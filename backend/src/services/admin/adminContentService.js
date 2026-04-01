import { prisma } from "../../config/prisma.js";
import { ApiError } from "../../utils/apiError.js";
import { buildPagination, getPagination } from "../../utils/pagination.js";
import {
  mapCmsContentItem,
  normalizeCmsSection,
  normalizeCmsStatus,
  slugifyCms,
  toNullableExcerpt,
} from "./adminService.utils.js";

export const adminContentService = {
  async contentList(query = {}) {
    const { page, limit, skip, take } = getPagination(query);
    const section = normalizeCmsSection(query.section);
    const status = normalizeCmsStatus(query.status);
    const search = String(query.search || query.q || "").trim();

    const where = {
      ...(section ? { section } : {}),
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" } },
              { slug: { contains: search, mode: "insensitive" } },
              { excerpt: { contains: search, mode: "insensitive" } },
              { contentMarkdown: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.cmsContent.findMany({
        where,
        skip,
        take,
        orderBy: [{ section: "asc" }, { sortOrder: "asc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
      }),
      prisma.cmsContent.count({ where }),
    ]);

    return {
      items: items.map(mapCmsContentItem),
      pagination: buildPagination(page, limit, total),
    };
  },

  async contentGet(contentId) {
    const item = await prisma.cmsContent.findUnique({ where: { id: contentId } });
    if (!item) throw new ApiError(404, "Content not found");
    return mapCmsContentItem(item);
  },

  async contentCreate(payload) {
    const section = normalizeCmsSection(payload.section);
    if (!section) throw new ApiError(400, "Invalid content section");

    const title = String(payload.title || "").trim();
    const slug = slugifyCms(payload.slug || title);
    if (!title) throw new ApiError(400, "Content title is required");
    if (!slug) throw new ApiError(400, "Content slug is required");

    const status = normalizeCmsStatus(payload.status, "DRAFT");
    const publishedAt =
      status === "PUBLISHED" ? (payload.publishedAt ? new Date(payload.publishedAt) : new Date()) : null;

    try {
      const created = await prisma.cmsContent.create({
        data: {
          section,
          slug,
          title,
          excerpt: toNullableExcerpt(payload.excerpt),
          contentMarkdown: String(payload.contentMarkdown || ""),
          status,
          sortOrder: Math.max(0, Number(payload.sortOrder || 0)),
          publishedAt,
        },
      });
      return mapCmsContentItem(created);
    } catch (error) {
      if (String(error?.code || "") === "P2002") {
        throw new ApiError(409, "Content slug already exists in this section");
      }
      throw error;
    }
  },

  async contentPatch(contentId, payload) {
    const existing = await prisma.cmsContent.findUnique({ where: { id: contentId } });
    if (!existing) throw new ApiError(404, "Content not found");

    const nextSection = payload.section
      ? normalizeCmsSection(payload.section, existing.section)
      : existing.section;
    const nextTitle = payload.title !== undefined ? String(payload.title || "").trim() : existing.title;
    const nextSlug = payload.slug !== undefined ? slugifyCms(payload.slug) : existing.slug;
    const nextStatus = payload.status ? normalizeCmsStatus(payload.status, existing.status) : existing.status;

    if (!nextTitle) throw new ApiError(400, "Content title is required");
    if (!nextSlug) throw new ApiError(400, "Content slug is required");

    const shouldPublishNow = existing.status !== "PUBLISHED" && nextStatus === "PUBLISHED";
    const explicitPublishedAt =
      payload.publishedAt !== undefined ? (payload.publishedAt ? new Date(payload.publishedAt) : null) : undefined;

    try {
      const updated = await prisma.cmsContent.update({
        where: { id: contentId },
        data: {
          section: nextSection,
          title: nextTitle,
          slug: nextSlug,
          excerpt: payload.excerpt !== undefined ? toNullableExcerpt(payload.excerpt) : existing.excerpt,
          contentMarkdown:
            payload.contentMarkdown !== undefined
              ? String(payload.contentMarkdown || "")
              : existing.contentMarkdown,
          status: nextStatus,
          sortOrder:
            payload.sortOrder !== undefined ? Math.max(0, Number(payload.sortOrder || 0)) : existing.sortOrder,
          publishedAt:
            explicitPublishedAt !== undefined
              ? explicitPublishedAt
              : shouldPublishNow
                ? new Date()
                : nextStatus === "DRAFT"
                  ? null
                  : existing.publishedAt,
        },
      });
      return mapCmsContentItem(updated);
    } catch (error) {
      if (String(error?.code || "") === "P2002") {
        throw new ApiError(409, "Content slug already exists in this section");
      }
      throw error;
    }
  },

  async contentDelete(contentId) {
    const existing = await prisma.cmsContent.findUnique({ where: { id: contentId }, select: { id: true } });
    if (!existing) throw new ApiError(404, "Content not found");
    await prisma.cmsContent.delete({ where: { id: contentId } });
    return { deleted: true, id: contentId };
  },
};
