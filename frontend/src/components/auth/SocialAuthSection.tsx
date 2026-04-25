import type { CredentialResponse } from "@react-oauth/google";
import { SocialAuthButton } from "./SocialAuthButton";

type SocialAuthSectionProps = {
  googleClientId?: string;
  onGoogleSuccess: (credentialResponse: CredentialResponse) => void;
  onGoogleError?: () => void;
  googleText?: string;
  googleLoading?: boolean;
  googleLoadingLabel?: string;
  googleUnavailableLabel?: string;
  onGoogleUnavailableClick?: () => void;
  appleEnabled?: boolean;
  appleText?: string;
  onAppleClick?: () => void;
  appleLoading?: boolean;
  className?: string;
};

export function SocialAuthSection({
  googleClientId,
  onGoogleSuccess,
  onGoogleError,
  googleText = "Continue with Google",
  googleLoading,
  googleLoadingLabel = "Continuing with Google...",
  googleUnavailableLabel = "Google sign-in unavailable",
  onGoogleUnavailableClick,
  appleEnabled,
  appleText = "Continue with Apple",
  onAppleClick,
  appleLoading,
  className = "",
}: SocialAuthSectionProps) {
  const googleEnabled = Boolean(googleClientId);
  const canUseApple = Boolean(appleEnabled) && typeof onAppleClick === "function";
  const isBusy = Boolean(googleLoading || appleLoading);

  return (
    <div className={className} aria-busy={isBusy ? true : undefined}>
      <div className="mx-auto w-full max-w-sm space-y-3">
        {googleEnabled ? (
          <SocialAuthButton
            provider="google"
            onSuccess={onGoogleSuccess}
            onError={onGoogleError}
            text={googleText}
            className={isBusy ? "w-full pointer-events-none opacity-60" : "w-full"}
          />
        ) : (
          <button
            type="button"
            onClick={onGoogleUnavailableClick}
            className="h-10 w-full rounded border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 active:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!onGoogleUnavailableClick}
          >
            {googleUnavailableLabel}
          </button>
        )}

        {canUseApple ? (
          <SocialAuthButton
            provider="apple"
            onClick={onAppleClick!}
            label={appleText}
            loading={appleLoading}
            disabled={googleLoading}
            className="w-full"
          />
        ) : null}

        {googleLoading ? (
          <p aria-live="polite" className="text-center text-xs text-slate-500">
            {googleLoadingLabel}
          </p>
        ) : null}
      </div>
    </div>
  );
}