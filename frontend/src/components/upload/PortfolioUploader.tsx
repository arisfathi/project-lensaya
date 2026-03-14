import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios, { type AxiosProgressEvent } from "axios";
import imageCompression from "browser-image-compression";
import { useDropzone, type FileRejection } from "react-dropzone";
import { Check, ImageIcon, UploadCloud, X } from "lucide-react";
import { useToast } from "../../contexts/ToastContext";
import { getApiErrorMessage, portfolioApi, uploadsApi } from "../../lib/api";
import { Button } from "../ui/Button";
import { Dropdown } from "../ui/Dropdown";
import { FormInput } from "../ui/FormInput";

const MAX_FILES = 20;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const ACCEPTED_FILE_TYPES = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
} as const;
const ACCEPTED_MIME_TYPES = new Set<string>(Object.keys(ACCEPTED_FILE_TYPES));
const FILE_TOO_LARGE_MESSAGE = "File too large. Maximum size is 10MB.";
const UNSUPPORTED_FILE_TYPE_MESSAGE = "Unsupported file type. Please upload JPG, PNG, or WEBP.";
const NETWORK_UPLOAD_ERROR_MESSAGE = "Network error occurred during upload. Please try again.";

type UploadStatus = "waiting" | "uploading" | "done" | "error";

export type UploadFile = {
  id: string;
  file: File;
  preview: string;
  progress: number;
  status: UploadStatus;
  errorMessage?: string;
  assetId?: string;
  cleanupEligible?: boolean;
};

type ServiceOption = {
  id: string;
  name: string;
};

type PortfolioUploaderProps = {
  services: ServiceOption[];
  onClose: () => void;
  onUploadSuccess: () => Promise<void> | void;
};

const createUploadItem = (file: File): UploadFile => ({
  id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 10)}`,
  file,
  preview: URL.createObjectURL(file),
  progress: 0,
  status: "waiting",
  assetId: undefined,
  cleanupEligible: false,
});

const toRejectionMessage = (rejection: FileRejection) => {
  const reason = rejection.errors[0];
  if (!reason) {
    return "Upload failed. Please try again.";
  }

  if (reason.code === "file-too-large") {
    return FILE_TOO_LARGE_MESSAGE;
  }
  if (reason.code === "file-invalid-type") {
    return UNSUPPORTED_FILE_TYPE_MESSAGE;
  }
  if (reason.code === "too-many-files") {
    return `You can upload up to ${MAX_FILES} files at once`;
  }
  return reason.message || "Upload failed. Please try again.";
};

const compressImage = async (file: File) => {
  return imageCompression(file, {
    maxSizeMB: 2,
    maxWidthOrHeight: 3000,
    useWebWorker: true,
  });
};

const validateUploadFile = (file: File) => {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return FILE_TOO_LARGE_MESSAGE;
  }
  if (!ACCEPTED_MIME_TYPES.has(file.type)) {
    return UNSUPPORTED_FILE_TYPE_MESSAGE;
  }
  return null;
};

const resolveUploadErrorMessage = (err: unknown) => {
  if (axios.isAxiosError(err) && !err.response) {
    return NETWORK_UPLOAD_ERROR_MESSAGE;
  }
  if (err instanceof TypeError && /network|failed to fetch|load failed/i.test(err.message)) {
    return NETWORK_UPLOAD_ERROR_MESSAGE;
  }
  return getApiErrorMessage(err, "Upload failed. Please try again.");
};

export function PortfolioUploader({ services, onClose, onUploadSuccess }: PortfolioUploaderProps) {
  const { success, error, info } = useToast();

  const [files, setFiles] = useState<UploadFile[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [category, setCategory] = useState("");
  const [featured, setFeatured] = useState(false);
  const [dropError, setDropError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const filesRef = useRef<UploadFile[]>([]);

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  useEffect(() => {
    return () => {
      filesRef.current.forEach((item) => {
        URL.revokeObjectURL(item.preview);
        if (item.assetId && item.cleanupEligible && item.status !== "done") {
          void uploadsApi.remove(item.assetId).catch((cleanupError) => {
            console.error("Failed to cleanup upload asset", cleanupError);
          });
        }
      });
    };
  }, []);

  useEffect(() => {
    if (!serviceId && services.length > 0) {
      setServiceId(services[0].id);
    }
  }, [serviceId, services]);

  const serviceOptions = useMemo(
    () => [{ value: "", label: "No service" }, ...services.map((service) => ({ value: service.id, label: service.name }))],
    [services]
  );

  const uploadableCount = useMemo(
    () => files.filter((item) => item.status === "waiting" || item.status === "error").length,
    [files]
  );

  const updateFileState = useCallback((fileId: string, updates: Partial<UploadFile>) => {
    setFiles((current) => current.map((item) => (item.id === fileId ? { ...item, ...updates } : item)));
  }, []);

  const cleanupUploadedAsset = useCallback(async (assetId?: string) => {
    if (!assetId) return false;

    try {
      await uploadsApi.remove(assetId);
      return true;
    } catch (cleanupError) {
      console.error("Failed to cleanup upload asset", cleanupError);
      return false;
    }
  }, []);

  const removeFile = useCallback(
    (fileId: string) => {
      if (isUploading) return;

      let orphanAssetId: string | undefined;

      setFiles((current) => {
        const target = current.find((item) => item.id === fileId);
        if (target) {
          URL.revokeObjectURL(target.preview);
          if (target.assetId && target.cleanupEligible && target.status !== "done") {
            orphanAssetId = target.assetId;
          }
        }
        return current.filter((item) => item.id !== fileId);
      });

      if (orphanAssetId) {
        void cleanupUploadedAsset(orphanAssetId);
      }
    },
    [cleanupUploadedAsset, isUploading]
  );

  const handleDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
      if (isUploading) return;

      setDropError(null);

      if (rejectedFiles.length > 0) {
        const message = rejectedFiles.map(toRejectionMessage).join(", ");
        setDropError(message);
        error(message);
      }

      if (acceptedFiles.length === 0) {
        return;
      }

      const remainingSlots = MAX_FILES - filesRef.current.length;
      if (remainingSlots <= 0) {
        const message = `You can upload up to ${MAX_FILES} images per batch.`;
        setDropError(message);
        info(message);
        return;
      }

      if (acceptedFiles.length > remainingSlots) {
        info(`Only ${remainingSlots} more image(s) were added (max ${MAX_FILES}).`);
      }

      const nextItems = acceptedFiles.slice(0, remainingSlots).map(createUploadItem);
      setFiles((current) => [...current, ...nextItems]);
    },
    [error, info, isUploading]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleDrop,
    accept: ACCEPTED_FILE_TYPES,
    maxSize: MAX_FILE_SIZE_BYTES,
    maxFiles: MAX_FILES,
    multiple: true,
    disabled: isUploading,
  });

  const uploadToStorage = useCallback(
    async (
      uploadUrl: string,
      file: File,
      headers: Record<string, string> | undefined,
      onProgress: (progress: number) => void
    ) => {
      await axios.put(uploadUrl, file, {
        headers,
        onUploadProgress: (event: AxiosProgressEvent) => {
          const total = event.total ?? file.size;
          if (!total) return;
          const percent = Math.min(100, Math.round((event.loaded * 100) / total));
          onProgress(percent);
        },
      });
    },
    []
  );

  const uploadSingleFile = useCallback(
    async (item: UploadFile) => {
      if (item.assetId && item.cleanupEligible) {
        const removedStaleAsset = await cleanupUploadedAsset(item.assetId);
        if (removedStaleAsset) {
          updateFileState(item.id, { assetId: undefined, cleanupEligible: false });
        }
      }

      const validationError = validateUploadFile(item.file);
      if (validationError) {
        updateFileState(item.id, {
          status: "error",
          progress: 0,
          errorMessage: validationError,
        });
        return false;
      }

      updateFileState(item.id, { status: "uploading", progress: 0, errorMessage: undefined });

      let currentAssetId = item.assetId;
      let cleanupEligible = Boolean(item.cleanupEligible);

      try {
        const compressed = await compressImage(item.file);
        const mimeType = compressed.type || item.file.type;

        const presigned = await uploadsApi.presign({
          fileName: compressed.name || item.file.name,
          mimeType,
          size: compressed.size,
          purpose: "portfolio",
        });

        currentAssetId = presigned.assetId;
        cleanupEligible = true;
        updateFileState(item.id, { assetId: currentAssetId, cleanupEligible: true });

        await uploadToStorage(presigned.uploadUrl, compressed, presigned.headers, (progress) => {
          updateFileState(item.id, { progress });
        });

        await uploadsApi.complete(presigned.assetId);
        cleanupEligible = false;
        updateFileState(item.id, { cleanupEligible: false });

        await portfolioApi.create({
          imageAssetId: presigned.assetId,
          serviceId: serviceId || undefined,
          category: category.trim() || undefined,
          featured,
        });

        updateFileState(item.id, {
          status: "done",
          progress: 100,
          errorMessage: undefined,
          assetId: presigned.assetId,
          cleanupEligible: false,
        });

        return true;
      } catch (err) {
        console.error("Portfolio upload failed", err);

        if (!currentAssetId) {
          const latestItem = filesRef.current.find((entry) => entry.id === item.id);
          currentAssetId = latestItem?.assetId;
          cleanupEligible = Boolean(latestItem?.cleanupEligible);
        }

        if (currentAssetId && cleanupEligible) {
          const removedAsset = await cleanupUploadedAsset(currentAssetId);
          if (removedAsset) {
            currentAssetId = undefined;
            cleanupEligible = false;
          }
        }

        const errorMessage = resolveUploadErrorMessage(err);
        updateFileState(item.id, {
          status: "error",
          progress: 0,
          errorMessage,
          assetId: currentAssetId,
          cleanupEligible,
        });
        return false;
      }
    },
    [category, cleanupUploadedAsset, featured, serviceId, updateFileState, uploadToStorage]
  );

  const finishSuccessfulUpload = useCallback(
    async (uploadedCount: number) => {
      success(`Uploaded ${uploadedCount} photo${uploadedCount === 1 ? "" : "s"} successfully.`);
      onClose();
      await onUploadSuccess();
    },
    [onClose, onUploadSuccess, success]
  );

  const handleUpload = useCallback(async () => {
    if (filesRef.current.length === 0) {
      error("Add at least one image to upload.");
      return;
    }

    const snapshot = filesRef.current;
    const targets = snapshot.filter((item) => item.status === "waiting" || item.status === "error");
    if (targets.length === 0) {
      info("All selected images are already uploaded.");
      return;
    }

    setIsUploading(true);
    let failedCount = 0;

    try {
      for (const item of targets) {
        const ok = await uploadSingleFile(item);
        if (!ok) {
          failedCount += 1;
        }
      }
    } finally {
      setIsUploading(false);
    }

    if (failedCount === 0) {
      await finishSuccessfulUpload(snapshot.length);
      return;
    }

    if (failedCount > 0) {
      error(`${failedCount} image upload(s) failed. Retry failed items.`);
    }
  }, [error, finishSuccessfulUpload, info, uploadSingleFile]);

  const handleRetry = useCallback(
    async (fileId: string) => {
      if (isUploading) return;

      const snapshot = filesRef.current;
      const item = snapshot.find((entry) => entry.id === fileId);
      if (!item) return;

      const pendingOthers = snapshot.filter((entry) => entry.id !== fileId && entry.status !== "done").length;

      setIsUploading(true);
      let uploaded = false;

      try {
        uploaded = await uploadSingleFile(item);
      } finally {
        setIsUploading(false);
      }

      if (!uploaded) {
        error("Upload failed");
        return;
      }

      if (pendingOthers === 0) {
        await finishSuccessfulUpload(snapshot.length);
      }
    },
    [error, finishSuccessfulUpload, isUploading, uploadSingleFile]
  );

  return (
    <div className="space-y-6">
      <section
        {...getRootProps({
          className: `border-2 border-dashed border-gray-300 rounded-xl p-12 text-center hover:border-teal-500 transition ${
            isDragActive ? "border-teal-500 bg-teal-50/40" : "bg-slate-50/40"
          } ${isUploading ? "opacity-70 cursor-not-allowed" : "cursor-pointer"}`,
        })}
      >
        <input {...getInputProps()} />
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white shadow">
          <UploadCloud className="h-6 w-6 text-teal-600" />
        </div>
        <p className="text-sm font-semibold text-slate-900">Drag photos here</p>
        <p className="text-sm text-slate-600">or click to browse</p>
        <p className="mt-2 text-xs text-slate-500">JPG, JPEG, PNG, WEBP | up to 10MB | max 20 images</p>
      </section>

      {dropError ? <p className="text-sm text-red-600">{dropError}</p> : null}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-900">Preview Grid</h4>
          <span className="text-xs text-slate-500">
            {files.length}/{MAX_FILES}
          </span>
        </div>

        {files.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-slate-500">
            <ImageIcon className="mx-auto mb-2 h-5 w-5" />
            <p className="text-sm">No images selected yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {files.map((item) => (
              <article key={item.id} className="rounded-lg shadow overflow-hidden relative border border-gray-200 bg-white">
                <button
                  type="button"
                  className="absolute right-2 top-2 z-10 rounded-full bg-white/90 p-1 text-slate-600 shadow hover:text-slate-900 disabled:opacity-50"
                  onClick={() => removeFile(item.id)}
                  disabled={isUploading}
                  aria-label={`Remove ${item.file.name}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>

                {item.status === "done" ? (
                  <span className="absolute left-2 top-2 z-10 inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white shadow">
                    <Check className="h-4 w-4" />
                  </span>
                ) : null}

                <div className="aspect-square overflow-hidden bg-slate-100">
                  <img
                    src={item.preview}
                    alt={item.file.name}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                </div>

                <div className="p-2">
                  <p className="truncate text-xs font-medium text-slate-800" title={item.file.name}>
                    {item.file.name}
                  </p>

                  <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className={`h-1 transition-all ${item.status === "error" ? "bg-red-500" : "bg-teal-500"}`}
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>

                  <div className="mt-1 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">{item.status === "uploading" ? `${item.progress}%` : item.status}</span>
                    {item.status === "error" ? (
                      <button
                        type="button"
                        className="font-semibold text-teal-600 hover:text-teal-700 disabled:opacity-50"
                        onClick={() => {
                          void handleRetry(item.id);
                        }}
                        disabled={isUploading}
                      >
                        Retry
                      </button>
                    ) : null}
                  </div>

                  {item.status === "error" ? <p className="mt-1 text-[11px] text-red-600">{item.errorMessage || "Upload failed"}</p> : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Dropdown
          label="Service"
          value={serviceId}
          onChange={(event) => setServiceId(event.target.value)}
          options={serviceOptions}
          disabled={isUploading}
        />

        <FormInput
          label="Category"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          placeholder="Ceremony"
          disabled={isUploading}
        />

        <label className="mt-7 inline-flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={featured}
            onChange={(event) => setFeatured(event.target.checked)}
            disabled={isUploading}
          />
          Mark as featured
        </label>
      </section>

      <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
        <Button variant="secondary" onClick={onClose} disabled={isUploading}>
          Cancel
        </Button>
        <Button onClick={() => void handleUpload()} disabled={isUploading || uploadableCount === 0}>
          {isUploading
            ? "Uploading..."
            : `Upload (${uploadableCount} photo${uploadableCount === 1 ? "" : "s"})`}
        </Button>
      </div>
    </div>
  );
}
