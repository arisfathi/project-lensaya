import { ConfirmDialog } from "../../../../components/ui/ConfirmDialog";
import type { PhotographerItem } from "../types";

type PhotographerStatusConfirmDialogProps = {
  statusTarget: PhotographerItem | null;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function PhotographerStatusConfirmDialog({
  statusTarget,
  loading,
  onCancel,
  onConfirm,
}: PhotographerStatusConfirmDialogProps) {
  return (
    <ConfirmDialog
      open={Boolean(statusTarget)}
      title={statusTarget?.status === "ACTIVE" ? "Suspend Photographer" : "Activate Photographer"}
      message={
        statusTarget?.status === "ACTIVE"
          ? `Suspend ${statusTarget?.name}? They will lose access until reactivated.`
          : `Activate ${statusTarget?.name}? They will be able to access their dashboard again.`
      }
      confirmLabel={statusTarget?.status === "ACTIVE" ? "Suspend" : "Activate"}
      loading={loading}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
