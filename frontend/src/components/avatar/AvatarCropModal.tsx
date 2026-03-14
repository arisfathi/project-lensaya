import { useCallback, useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";

type AvatarCropModalProps = {
  open: boolean;
  imageSrc: string | null;
  saving?: boolean;
  onCancel: () => void;
  onSave: (blob: Blob) => Promise<void> | void;
};

const createImage = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load image"));
    image.src = url;
  });

const getCroppedImageBlob = async (imageSrc: string, cropAreaPixels: Area) => {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(cropAreaPixels.width));
  canvas.height = Math.max(1, Math.floor(cropAreaPixels.height));

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas context unavailable");
  }

  context.drawImage(
    image,
    cropAreaPixels.x,
    cropAreaPixels.y,
    cropAreaPixels.width,
    cropAreaPixels.height,
    0,
    0,
    cropAreaPixels.width,
    cropAreaPixels.height
  );

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Unable to crop image"));
          return;
        }
        resolve(blob);
      },
      "image/jpeg",
      0.92
    );
  });
};

export function AvatarCropModal({ open, imageSrc, saving = false, onCancel, onSave }: AvatarCropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [renderingCrop, setRenderingCrop] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
  }, [open, imageSrc]);

  const handleCropComplete = useCallback((_croppedArea: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleSave = async () => {
    if (!imageSrc || !croppedAreaPixels) {
      return;
    }

    try {
      setRenderingCrop(true);
      const croppedBlob = await getCroppedImageBlob(imageSrc, croppedAreaPixels);
      await onSave(croppedBlob);
    } finally {
      setRenderingCrop(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Crop Profile Photo"
      onClose={saving || renderingCrop ? () => {} : onCancel}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onCancel} disabled={saving || renderingCrop}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={!imageSrc || !croppedAreaPixels || saving || renderingCrop}>
            {saving || renderingCrop ? "Saving..." : "Save Photo"}
          </Button>
        </div>
      }
    >
      {!imageSrc ? (
        <div className="text-sm text-slate-500">No image selected.</div>
      ) : (
        <div className="space-y-5">
          <div className="relative w-full h-72 sm:h-80 rounded-xl overflow-hidden bg-slate-900">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              objectFit="cover"
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={handleCropComplete}
            />
          </div>

          <div>
            <label htmlFor="avatar-zoom" className="block text-sm font-medium text-slate-700 mb-2">
              Zoom
            </label>
            <input
              id="avatar-zoom"
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
              className="w-full accent-cyan-500"
            />
          </div>
        </div>
      )}
    </Modal>
  );
}
