import type { PasswordForm } from "../types";

type AccountSecurityCardProps = {
  data: {
    showPasswordForm: boolean;
    passwordForm: PasswordForm;
    changingPassword: boolean;
    showDeleteConfirm: boolean;
    deletePassword: string;
    deleteConfirmation: string;
    deletingAccount: boolean;
  };
  actions: {
    onTogglePasswordForm: () => void;
    onPasswordFormChange: (value: PasswordForm) => void;
    onChangePassword: () => void;
    onToggleDeleteConfirm: () => void;
    onDeletePasswordChange: (value: string) => void;
    onDeleteConfirmationChange: (value: string) => void;
    onDeleteAccount: () => void;
  };
};

export function AccountSecurityCard({ data, actions }: AccountSecurityCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-sm md:p-6">
      <h3 className="mb-3 text-lg font-semibold text-slate-900">Account & Security</h3>
      <div className="space-y-2.5">
        <button
          type="button"
          onClick={actions.onTogglePasswordForm}
          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
        >
          Change Password
        </button>
        {data.showPasswordForm ? (
          <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-3.5 md:p-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1" htmlFor="current-password">
                Current Password
              </label>
              <input
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={data.passwordForm.currentPassword}
                onChange={(event) =>
                  actions.onPasswordFormChange({ ...data.passwordForm, currentPassword: event.target.value })
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition-all focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1" htmlFor="new-password">
                New Password
              </label>
              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={data.passwordForm.newPassword}
                onChange={(event) =>
                  actions.onPasswordFormChange({ ...data.passwordForm, newPassword: event.target.value })
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition-all focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1" htmlFor="confirm-new-password">
                Confirm New Password
              </label>
              <input
                id="confirm-new-password"
                type="password"
                autoComplete="new-password"
                value={data.passwordForm.confirmNewPassword}
                onChange={(event) =>
                  actions.onPasswordFormChange({ ...data.passwordForm, confirmNewPassword: event.target.value })
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition-all focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <button
              type="button"
              onClick={actions.onChangePassword}
              disabled={data.changingPassword}
              className="w-full rounded-lg bg-cyan-500 px-4 py-2 text-sm text-white transition-colors hover:bg-cyan-600 disabled:opacity-60"
            >
              {data.changingPassword ? "Updating..." : "Update Password"}
            </button>
          </div>
        ) : null}

        <button
          type="button"
          onClick={actions.onToggleDeleteConfirm}
          className="w-full rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-left text-sm font-medium text-red-600 transition-colors hover:bg-red-100"
        >
          Delete Account
        </button>
        {data.showDeleteConfirm ? (
          <div className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-3.5 md:p-4">
            <p className="text-xs text-red-700">
              This action is permanent. Enter your password (if you have one) and type DELETE to confirm.
            </p>
            <div>
              <label className="block text-xs font-medium text-red-700 mb-1" htmlFor="delete-password">
                Password
              </label>
              <input
                id="delete-password"
                type="password"
                autoComplete="current-password"
                value={data.deletePassword}
                onChange={(event) => actions.onDeletePasswordChange(event.target.value)}
                className="w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm outline-none transition-all focus:border-red-400 focus:ring-2 focus:ring-red-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-red-700 mb-1" htmlFor="delete-confirmation">
                Type DELETE
              </label>
              <input
                id="delete-confirmation"
                type="text"
                value={data.deleteConfirmation}
                onChange={(event) => actions.onDeleteConfirmationChange(event.target.value)}
                className="w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm outline-none transition-all focus:border-red-400 focus:ring-2 focus:ring-red-400"
              />
            </div>
            <button
              type="button"
              onClick={actions.onDeleteAccount}
              disabled={data.deletingAccount}
              className="w-full rounded-lg bg-red-600 px-4 py-2 text-sm text-white transition-colors hover:bg-red-700 disabled:opacity-60"
            >
              {data.deletingAccount ? "Deleting..." : "Permanently Delete Account"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
