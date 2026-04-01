import { useEffect, useState, type ChangeEvent } from "react";
import { ImagePlus, Plus, Save, Trash2, Users, X } from "lucide-react";
import { Link } from "react-router-dom";
import { DashboardLayout } from "../../components/dashboard/DashboardLayout";
import { DashboardPageHero } from "../../components/dashboard/DashboardPageHero";
import { LoadingCard } from "../../components/ui/LoadingSpinner";
import { ImageWithFallback } from "../../components/figma/ImageWithFallback";
import { profileApi, uploadsApi, getApiErrorMessage, isApiAccessError } from "../../lib/api";
import { useToast } from "../../contexts/ToastContext";

type TeamMemberForm = {
  name: string;
  role: string;
  image: string;
};

type TeamSettingsState = {
  enabled: boolean;
  members: TeamMemberForm[];
};

const emptyMember = (): TeamMemberForm => ({
  name: "",
  role: "",
  image: "",
});

const normalizeMember = (member: TeamMemberForm): TeamMemberForm => ({
  name: String(member?.name || "").trim(),
  role: String(member?.role || "").trim(),
  image: String(member?.image || "").trim(),
});

export default function TeamSettings() {
  const { success, error } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [canManageTeam, setCanManageTeam] = useState(false);
  const [team, setTeam] = useState<TeamSettingsState>({
    enabled: false,
    members: [emptyMember(), emptyMember(), emptyMember()],
  });

  useEffect(() => {
    let mounted = true;

    const loadTeamSettings = async () => {
      setLoading(true);
      try {
        const profile = await profileApi.get();
        if (!mounted) return;

        const normalized = Array.isArray(profile.teamSection?.members)
          ? profile.teamSection.members
              .map((member) => normalizeMember(member as TeamMemberForm))
              .filter((member) => member.name && member.role && member.image)
          : [];

        setCanManageTeam(Boolean(profile.teamSection?.canManage));
        setTeam({
          enabled: Boolean(profile.teamSection?.enabled),
          members: normalized.length > 0 ? normalized : [emptyMember(), emptyMember(), emptyMember()],
        });
      } catch (err) {
        if (!mounted || isApiAccessError(err)) return;
        error(getApiErrorMessage(err, "Failed to load team settings"));
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadTeamSettings();

    return () => {
      mounted = false;
    };
  }, [error]);

  const updateMember = (index: number, field: keyof TeamMemberForm, value: string) => {
    setTeam((current) => ({
      ...current,
      members: current.members.map((member, memberIndex) =>
        memberIndex === index
          ? {
              ...member,
              [field]: value,
            }
          : member
      ),
    }));
  };

  const handleMemberImageSelect = async (index: number, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      error("Only image files are supported");
      return;
    }

    try {
      setUploadingIndex(index);

      const presigned = await uploadsApi.presign({
        fileName: file.name,
        mimeType: file.type,
        size: file.size,
        purpose: "portfolio",
      });

      const uploadResponse = await fetch(presigned.uploadUrl, {
        method: "PUT",
        headers: presigned.headers,
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload team member image");
      }

      const completed = await uploadsApi.complete(presigned.assetId);
      const nextUrl = completed.publicUrl || completed.url || presigned.publicUrl || "";
      if (!nextUrl) {
        throw new Error("Uploaded image URL is unavailable");
      }

      updateMember(index, "image", nextUrl);
      success("Team member photo uploaded.");
    } catch (err) {
      error(getApiErrorMessage(err, "Failed to upload team member photo"));
    } finally {
      setUploadingIndex(null);
    }
  };

  const addMember = () => {
    setTeam((current) => ({
      ...current,
      members: [...current.members, emptyMember()].slice(0, 12),
    }));
  };

  const removeMember = (index: number) => {
    setTeam((current) => {
      const nextMembers = current.members.filter((_, memberIndex) => memberIndex !== index);
      return {
        ...current,
        members: nextMembers.length > 0 ? nextMembers : [emptyMember()],
      };
    });
  };

  const clearMemberImage = (index: number) => {
    updateMember(index, "image", "");
  };

  const handleSave = async () => {
    if (!canManageTeam) {
      error("Our Team is not available on your current plan.");
      return;
    }
    const cleaned = team.members
      .map(normalizeMember)
      .filter((member) => member.name && member.role && member.image)
      .slice(0, 12);

    if (team.enabled && cleaned.length === 0) {
      error("Add at least one team member before enabling the Team section.");
      return;
    }

    try {
      setSaving(true);
      await profileApi.update({
        teamSection: {
          enabled: team.enabled,
          members: cleaned,
        },
      });

      setTeam((current) => ({
        ...current,
        members: cleaned.length > 0 ? cleaned : [emptyMember(), emptyMember(), emptyMember()],
      }));
      success("Team section updated.");
    } catch (err) {
      error(getApiErrorMessage(err, "Failed to save team settings"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <LoadingCard label="Loading team settings..." />
      </DashboardLayout>
    );
  }

  if (!canManageTeam) {
    return (
      <DashboardLayout>
        <DashboardPageHero
          eyebrow="Team Roster Studio"
          title="Team"
          description="Manage the team members shown on your public photographer site."
        />

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Our Team is locked on your current plan. Upgrade first to manage this section.
          <div className="mt-2">
            <Link to="/dashboard/pricing" className="font-semibold text-amber-900 underline">
              View plans
            </Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <DashboardPageHero
        eyebrow="Team Roster Studio"
        title="Team"
        description="Manage the team members shown on your public photographer site."
      />

      <div className="space-y-4 sm:space-y-6">
        <div className="rounded-2xl border border-slate-200/80 bg-white px-3.5 py-3 sm:rounded-xl sm:border-gray-200 sm:p-6 sm:shadow-sm">
          <label className="flex items-start gap-2.5 sm:gap-3">
            <input
              type="checkbox"
              checked={team.enabled}
              onChange={(event) => setTeam((current) => ({ ...current, enabled: event.target.checked }))}
              disabled={!canManageTeam}
              className="mt-1 h-4 w-4 rounded border-gray-300"
            />
            <span>
              <span className="block text-sm font-semibold text-slate-900">Show "Our Team" section on public website</span>
              <span className="block text-[11px] text-slate-500 sm:text-xs">If disabled, the section will stay hidden from visitors.</span>
            </span>
          </label>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white px-3.5 py-3.5 sm:rounded-xl sm:border-gray-200 sm:p-6 sm:shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2.5 sm:mb-4 sm:gap-3">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-cyan-600" />
              <h2 className="text-base font-semibold text-slate-900 sm:text-lg">Team Members</h2>
            </div>
            <button
              type="button"
              onClick={addMember}
              disabled={!canManageTeam || team.members.length >= 12}
              className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-200 px-2.5 py-1.5 text-xs font-semibold text-cyan-700 transition-colors hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-60 sm:gap-2 sm:px-3 sm:py-2 sm:text-sm sm:font-medium"
            >
              <Plus className="h-4 w-4" />
              Add Member
            </button>
          </div>

          <div className="space-y-2.5 sm:space-y-4">
            {team.members.map((member, index) => (
              <div key={index} className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3 sm:rounded-lg sm:border-gray-200 sm:bg-white sm:p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="min-w-0 flex items-center gap-2.5">
                    <div className="h-10 w-10 overflow-hidden rounded-lg border border-slate-200 bg-white">
                      {member.image ? (
                        <ImageWithFallback src={member.image} alt={member.name || `Member ${index + 1}`} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">No photo</div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold uppercase tracking-wide text-slate-500">Member {index + 1}</p>
                      <p className="truncate text-sm font-semibold text-slate-900">{member.name || "Unnamed member"}</p>
                      <p className="truncate text-[11px] text-slate-500">{member.role || "Role not set"}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeMember(index)}
                    disabled={!canManageTeam}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 sm:text-sm sm:font-normal"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="hidden sm:inline">Remove</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs sm:font-medium sm:normal-case sm:tracking-normal sm:text-slate-600">Name</label>
                    <input
                      type="text"
                      value={member.name}
                      onChange={(event) => updateMember(index, "name", event.target.value)}
                      disabled={!canManageTeam}
                      placeholder="Aisha Rahman"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs sm:font-medium sm:normal-case sm:tracking-normal sm:text-slate-600">Role</label>
                    <input
                      type="text"
                      value={member.role}
                      onChange={(event) => updateMember(index, "role", event.target.value)}
                      disabled={!canManageTeam}
                      placeholder="Lead Photographer"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                </div>

                <div className="mt-3 rounded-lg border border-slate-200 bg-white/90 px-2.5 py-2.5 sm:mt-4 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
                  <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs sm:font-medium sm:normal-case sm:tracking-normal sm:text-slate-600">Photo</label>

                  <div className="flex flex-wrap items-center gap-2">
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-cyan-200 px-3 py-2 text-sm font-medium text-cyan-700 transition-colors hover:bg-cyan-50">
                        <ImagePlus className="h-4 w-4" />
                        {uploadingIndex === index ? "Uploading..." : member.image ? "Replace Photo" : "Upload Photo"}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(event) => {
                            void handleMemberImageSelect(index, event);
                          }}
                          disabled={!canManageTeam || uploadingIndex === index}
                        />
                      </label>

                      {member.image ? (
                        <button
                          type="button"
                          onClick={() => clearMemberImage(index)}
                          disabled={!canManageTeam}
                          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-gray-50"
                        >
                          <X className="h-4 w-4" />
                          Remove Photo
                        </button>
                      ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => {
              void handleSave();
            }}
            disabled={saving || !canManageTeam}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-cyan-600 disabled:opacity-60 sm:w-auto sm:text-base sm:font-normal"
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save Team Section"}
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}


