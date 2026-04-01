import { Star, Trash2 } from "lucide-react";
import { ImageWithFallback } from "../../../../components/figma/ImageWithFallback";
import type { PortfolioItem, ServiceItem } from "../types";
import { getCategoryLabel } from "../utils";

type PortfolioGalleryProps = {
  data: {
    items: PortfolioItem[];
    filteredItems: PortfolioItem[];
    services: ServiceItem[];
    selectedCategory: string;
    featuredCount: number;
    toggleId: string | null;
  };
  handlers: {
    onToggleFeatured: (item: PortfolioItem) => void;
    onEdit: (item: PortfolioItem) => void;
    onDelete: (item: PortfolioItem) => void;
  };
};

export function PortfolioGallery({ data, handlers }: PortfolioGalleryProps) {
  return (
    <>
      {data.selectedCategory === "All" && data.featuredCount > 0 ? (
        <div className="mb-6 sm:mb-8">
          <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-900 sm:mb-4 sm:text-lg">
            <Star className="h-4 w-4 fill-yellow-500 text-yellow-500 sm:h-5 sm:w-5" />
            Featured Portfolio
          </h3>

          <div className="scrollbar-hide -mx-1 overflow-x-auto px-1 pb-1 sm:hidden">
            <div className="flex w-max gap-2.5">
              {data.items
                .filter((item) => item.featured)
                .map((item) => (
                  <article
                    key={`featured-mobile-${item.id}`}
                    className="group relative w-64 overflow-hidden rounded-2xl border border-yellow-200 bg-white"
                  >
                    <div className="aspect-square overflow-hidden bg-gray-100">
                      <ImageWithFallback
                        src={item.imageUrl || ""}
                        alt="Portfolio"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                      />
                    </div>

                    <div className="absolute inset-0 bg-linear-to-t from-slate-950/70 via-slate-900/20 to-transparent" />
                    <div className="absolute left-0 right-0 bottom-0 px-3 py-3 text-white">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-semibold">{getCategoryLabel(item, data.services)}</span>
                        <span className="text-[11px] text-slate-100">{item.views} views</span>
                      </div>
                    </div>
                    <div className="absolute right-2 top-2 flex items-center gap-1.5">
                      <button
                        type="button"
                        className="rounded-md bg-white/90 p-1.5 transition-colors hover:bg-white"
                        onClick={() => {
                          handlers.onToggleFeatured(item);
                        }}
                        disabled={data.toggleId === item.id}
                      >
                        <Star className="h-3.5 w-3.5 fill-yellow-500 text-yellow-500" />
                      </button>
                      <button
                        type="button"
                        className="rounded-md bg-white/90 px-2 py-1 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-white"
                        onClick={() => handlers.onEdit(item)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="rounded-md bg-white/90 p-1.5 transition-colors hover:bg-white"
                        onClick={() => handlers.onDelete(item)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      </button>
                    </div>
                  </article>
                ))}
            </div>
          </div>

          <div className="hidden gap-4 sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {data.items
              .filter((item) => item.featured)
              .map((item) => (
                <div
                  key={`featured-${item.id}`}
                  className="group relative overflow-hidden rounded-xl border-2 border-yellow-200 bg-white shadow-sm transition-all hover:shadow-lg"
                >
                  <div className="aspect-square overflow-hidden bg-gray-100">
                    <ImageWithFallback
                      src={item.imageUrl || ""}
                      alt="Portfolio"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                    />
                  </div>

                  <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100">
                    <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{getCategoryLabel(item, data.services)}</span>
                        <span className="text-xs">{item.views} views</span>
                      </div>
                    </div>
                    <div className="absolute top-2 right-2 flex gap-2">
                      <button
                        type="button"
                        className="p-2 bg-white/90 rounded-lg hover:bg-white transition-colors"
                        onClick={() => {
                          handlers.onToggleFeatured(item);
                        }}
                        disabled={data.toggleId === item.id}
                      >
                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                      </button>
                      <button
                        type="button"
                        className="rounded-lg bg-white/90 px-2 py-1 text-xs font-semibold text-slate-700 transition-colors hover:bg-white"
                        onClick={() => handlers.onEdit(item)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="p-2 bg-white/90 rounded-lg hover:bg-white transition-colors"
                        onClick={() => handlers.onDelete(item)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      ) : null}

      <div>
        <h3 className="mb-3 text-base font-semibold text-slate-900 sm:mb-4 sm:text-lg">
          {data.selectedCategory === "All" ? "All Photos" : `${data.selectedCategory} Photos`}
        </h3>

        {data.filteredItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white/80 py-10 text-center sm:rounded-xl sm:py-12">
            <p className="text-sm text-slate-600">No photos in this category yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
            {data.filteredItems.map((item) => (
              <article
                key={item.id}
                className="group relative overflow-hidden rounded-xl border border-slate-200/80 bg-white sm:border-gray-200 sm:shadow-sm sm:transition-all sm:hover:shadow-lg"
              >
                <div className="aspect-square overflow-hidden bg-gray-100">
                  <ImageWithFallback
                    src={item.imageUrl || ""}
                    alt="Portfolio"
                    className="h-full w-full object-cover transition-transform duration-300 sm:group-hover:scale-110"
                  />
                </div>

                <div className="absolute inset-0 hidden bg-linear-to-t from-black/60 to-transparent opacity-0 transition-opacity sm:block sm:group-hover:opacity-100">
                  <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{getCategoryLabel(item, data.services)}</span>
                      <span className="text-xs">{item.views} views</span>
                    </div>
                  </div>
                  <div className="absolute top-2 right-2 flex gap-2">
                    <button
                      type="button"
                      className="p-2 bg-white/90 rounded-lg hover:bg-white transition-colors"
                      onClick={() => {
                        handlers.onToggleFeatured(item);
                      }}
                      disabled={data.toggleId === item.id}
                    >
                      <Star
                        className={`w-4 h-4 ${item.featured ? "text-yellow-500 fill-yellow-500" : "text-slate-400"}`}
                      />
                    </button>
                    <button
                      type="button"
                      className="p-2 bg-white/90 rounded-lg hover:bg-white transition-colors"
                      onClick={() => handlers.onEdit(item)}
                    >
                      <span className="text-xs font-semibold text-slate-600">Edit</span>
                    </button>
                    <button
                      type="button"
                      className="p-2 bg-white/90 rounded-lg hover:bg-white transition-colors"
                      onClick={() => handlers.onDelete(item)}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-2.5 py-2 sm:hidden">
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-semibold text-slate-700">{getCategoryLabel(item, data.services)}</p>
                    <p className="text-[10px] text-slate-500">{item.views} views</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100"
                      onClick={() => {
                        handlers.onToggleFeatured(item);
                      }}
                      disabled={data.toggleId === item.id}
                    >
                      <Star className={`h-3.5 w-3.5 ${item.featured ? "fill-yellow-500 text-yellow-500" : "text-slate-400"}`} />
                    </button>
                    <button
                      type="button"
                      className="rounded-md px-2 py-1 text-[10px] font-semibold text-slate-600 transition-colors hover:bg-slate-100"
                      onClick={() => handlers.onEdit(item)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="rounded-md p-1.5 text-red-500 transition-colors hover:bg-red-50"
                      onClick={() => handlers.onDelete(item)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
