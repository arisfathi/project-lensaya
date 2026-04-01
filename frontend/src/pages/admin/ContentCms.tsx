import { useEffect, useMemo, useState } from "react";
import { Edit, Plus, Save, Trash2 } from "lucide-react";
import { AdminLayout } from "../../components/admin/AdminLayout";
import { Button } from "../../components/ui/Button";
import { LoadingCard } from "../../components/ui/LoadingSpinner";
import { Modal } from "../../components/ui/Modal";
import { adminApi, getApiErrorMessage } from "../../lib/api";
import { useToast } from "../../contexts/ToastContext";

type CmsSection = "RESOURCES" | "HELP_CENTER" | "BLOG" | "GUIDES" | "ABOUT" | "CONTACT" | "LEGAL";
type CmsStatus = "DRAFT" | "PUBLISHED";

type CmsItem = {
  id: string;
  section: CmsSection;
  slug: string;
  title: string;
  excerpt: string | null;
  contentMarkdown: string;
  status: CmsStatus;
  sortOrder: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type EditorState = {
  id: string | null;
  section: CmsSection;
  slug: string;
  title: string;
  excerpt: string;
  contentMarkdown: string;
  status: CmsStatus;
  sortOrder: number;
  publishedAt: string;
};

const sectionLabels: Record<CmsSection, string> = {
  RESOURCES: "Resources",
  HELP_CENTER: "Help Center",
  BLOG: "Blog",
  GUIDES: "Guides",
  ABOUT: "About",
  CONTACT: "Contact",
  LEGAL: "Legal",
};

const sectionOptions: CmsSection[] = ["RESOURCES", "HELP_CENTER", "BLOG", "GUIDES", "ABOUT", "CONTACT", "LEGAL"];

const emptyEditor = (): EditorState => ({
  id: null,
  section: "BLOG",
  slug: "",
  title: "",
  excerpt: "",
  contentMarkdown: "",
  status: "DRAFT",
  sortOrder: 0,
  publishedAt: "",
});

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const formatDateTime = (value: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

export default function ContentCms() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [items, setItems] = useState<CmsItem[]>([]);
  const [filterSection, setFilterSection] = useState<"ALL" | CmsSection>("ALL");
  const [filterStatus, setFilterStatus] = useState<"ALL" | CmsStatus>("ALL");
  const [search, setSearch] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editor, setEditor] = useState<EditorState>(emptyEditor());

  const { success, error } = useToast();

  const loadItems = async () => {
    const result = await adminApi.contentList({
      section: filterSection === "ALL" ? undefined : filterSection,
      status: filterStatus === "ALL" ? undefined : filterStatus,
      search: search.trim() || undefined,
      limit: 100,
      page: 1,
    });
    setItems(result.items as CmsItem[]);
  };

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      setLoading(true);
      try {
        await loadItems();
      } catch (err) {
        if (mounted) {
          error(getApiErrorMessage(err, "Failed to load content"));
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void run();
    return () => {
      mounted = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- pre-existing dependency shape; isolated in Phase 1.5
  }, [filterSection, filterStatus, search, error]);

  const summary = useMemo(() => {
    const total = items.length;
    const published = items.filter((item) => item.status === "PUBLISHED").length;
    const draft = total - published;
    return { total, published, draft };
  }, [items]);

  const openCreate = () => {
    setEditor(emptyEditor());
    setEditorOpen(true);
  };

  const openEdit = (item: CmsItem) => {
    setEditor({
      id: item.id,
      section: item.section,
      slug: item.slug,
      title: item.title,
      excerpt: item.excerpt || "",
      contentMarkdown: item.contentMarkdown,
      status: item.status,
      sortOrder: item.sortOrder,
      publishedAt: item.publishedAt ? new Date(item.publishedAt).toISOString().slice(0, 16) : "",
    });
    setEditorOpen(true);
  };

  const saveEntry = async () => {
    if (!editor.title.trim()) {
      error("Title is required");
      return;
    }
    if (!editor.contentMarkdown.trim()) {
      error("Content markdown is required");
      return;
    }

    const payload = {
      section: editor.section,
      slug: slugify(editor.slug || editor.title),
      title: editor.title.trim(),
      excerpt: editor.excerpt.trim() || null,
      contentMarkdown: editor.contentMarkdown,
      status: editor.status,
      sortOrder: Math.max(0, Number(editor.sortOrder || 0)),
      publishedAt: editor.publishedAt ? new Date(editor.publishedAt).toISOString() : null,
    };

    try {
      setSaving(true);
      if (editor.id) {
        await adminApi.contentPatch(editor.id, payload);
        success("Content updated");
      } else {
        await adminApi.contentCreate(payload);
        success("Content created");
      }
      setEditorOpen(false);
      await loadItems();
    } catch (err) {
      error(getApiErrorMessage(err, "Failed to save content"));
    } finally {
      setSaving(false);
    }
  };

  const deleteEntry = async (id: string) => {
    try {
      setDeletingId(id);
      await adminApi.contentDelete(id);
      success("Content deleted");
      await loadItems();
    } catch (err) {
      error(getApiErrorMessage(err, "Failed to delete content"));
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <LoadingCard label="Loading content CMS..." />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Content CMS</h1>
          <p className="mt-1 text-sm text-slate-600">Manage Resources, Help Center, Blog, and Guides pages.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          New Entry
        </Button>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{summary.total}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Published</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-600">{summary.published}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Draft</p>
          <p className="mt-1 text-2xl font-semibold text-amber-600">{summary.draft}</p>
        </div>
      </div>

      <div className="mb-6 grid gap-3 rounded-xl border border-gray-200 bg-white p-4 md:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Search</label>
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Title, slug, content"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Section</label>
          <select
            value={filterSection}
            onChange={(event) => setFilterSection(event.target.value as "ALL" | CmsSection)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none"
          >
            <option value="ALL">All Sections</option>
            {sectionOptions.map((section) => (
              <option key={section} value={section}>
                {sectionLabels[section]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Status</label>
          <select
            value={filterStatus}
            onChange={(event) => setFilterStatus(event.target.value as "ALL" | CmsStatus)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="PUBLISHED">Published</option>
            <option value="DRAFT">Draft</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Title</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Section</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Sort</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Updated</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                  No content entries found.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="hover:bg-cyan-50/30">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{item.title}</p>
                    <p className="text-xs text-slate-500">/{item.slug}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">{sectionLabels[item.section]}</td>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-semibold ${
                        item.status === "PUBLISHED" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">{item.sortOrder}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{formatDateTime(item.updatedAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(item)}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-gray-50"
                      >
                        <Edit className="h-3.5 w-3.5" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteEntry(item.id)}
                        disabled={deletingId === item.id}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {deletingId === item.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editor.id ? "Edit Content" : "Create Content"}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditorOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void saveEntry()} disabled={saving}>
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Section</label>
              <select
                value={editor.section}
                onChange={(event) => setEditor((current) => ({ ...current, section: event.target.value as CmsSection }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none"
              >
                {sectionOptions.map((section) => (
                  <option key={section} value={section}>
                    {sectionLabels[section]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
              <select
                value={editor.status}
                onChange={(event) => setEditor((current) => ({ ...current, status: event.target.value as CmsStatus }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none"
              >
                <option value="DRAFT">Draft</option>
                <option value="PUBLISHED">Published</option>
              </select>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Title</label>
              <input
                type="text"
                value={editor.title}
                onChange={(event) =>
                  setEditor((current) => {
                    const title = event.target.value;
                    return {
                      ...current,
                      title,
                      slug: current.slug ? current.slug : slugify(title),
                    };
                  })
                }
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Slug</label>
              <input
                type="text"
                value={editor.slug}
                onChange={(event) => setEditor((current) => ({ ...current, slug: slugify(event.target.value) }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Excerpt</label>
            <textarea
              rows={2}
              value={editor.excerpt}
              onChange={(event) => setEditor((current) => ({ ...current, excerpt: event.target.value }))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Sort Order</label>
              <input
                type="number"
                min={0}
                value={editor.sortOrder}
                onChange={(event) =>
                  setEditor((current) => ({ ...current, sortOrder: Math.max(0, Number(event.target.value || 0)) }))
                }
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Publish At (optional)</label>
              <input
                type="datetime-local"
                value={editor.publishedAt}
                onChange={(event) => setEditor((current) => ({ ...current, publishedAt: event.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Markdown Content</label>
            <textarea
              rows={14}
              value={editor.contentMarkdown}
              onChange={(event) => setEditor((current) => ({ ...current, contentMarkdown: event.target.value }))}
              placeholder="Write markdown content..."
              className="w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-sm focus:border-cyan-500 focus:outline-none"
            />
          </div>
        </div>
      </Modal>
    </AdminLayout>
  );
}



