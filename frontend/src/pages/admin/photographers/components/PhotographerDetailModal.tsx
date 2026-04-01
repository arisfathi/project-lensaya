import { Modal } from "../../../../components/ui/Modal";
import { LoadingSpinner } from "../../../../components/ui/LoadingSpinner";
import type { PhotographerDetail } from "../types";
import { formatPlan, formatStatus } from "../utils";

type PhotographerDetailModalProps = {
  open: boolean;
  detailLoading: boolean;
  detail: PhotographerDetail | null;
  onClose: () => void;
};

export function PhotographerDetailModal({ open, detailLoading, detail, onClose }: PhotographerDetailModalProps) {
  return (
    <Modal open={open} title="Photographer Details" onClose={onClose}>
      {detailLoading ? (
        <LoadingSpinner label="Loading details..." />
      ) : detail ? (
        <div className="space-y-3">
          <div>
            <p className="text-sm text-slate-500">Name</p>
            <p className="text-sm font-medium text-slate-900">{detail.photographer.fullName}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Email</p>
            <p className="text-sm font-medium text-slate-900">{detail.photographer.email}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Username</p>
            <p className="text-sm font-medium text-slate-900">@{detail.photographer.username || "unknown"}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Plan</p>
            <p className="text-sm font-medium text-slate-900">{formatPlan(detail.subscription?.plan || "FREE")}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Status</p>
            <p className="text-sm font-medium text-slate-900">{formatStatus(detail.photographer.status)}</p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-500">No details available.</p>
      )}
    </Modal>
  );
}
