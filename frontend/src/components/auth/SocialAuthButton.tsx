import { GoogleLogin, type CredentialResponse } from "@react-oauth/google";

const APPLE_LOGO_PATH =
  "M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z";

const Spinner = ({ className = "" }: { className?: string }) => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className={`h-4 w-4 animate-spin text-white ${className}`}>
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v3.2a4.8 4.8 0 00-4.8 4.8H4z" />
  </svg>
);

const appleButtonClassName =
  "relative flex min-h-11 w-full items-center justify-center gap-3 rounded-lg bg-black px-4 py-3 text-white transition-colors hover:bg-gray-900 active:bg-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-60";

type GoogleButtonProps = {
  provider: "google";
  onSuccess: (credentialResponse: CredentialResponse) => void;
  onError?: () => void;
  text?: string;
  className?: string;
};

type AppleButtonProps = {
  provider: "apple";
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  label?: string;
  className?: string;
};

export type SocialAuthButtonProps = GoogleButtonProps | AppleButtonProps;

type GoogleSocialAuthButtonProps = Omit<GoogleButtonProps, "provider">;

type AppleSocialAuthButtonProps = Omit<AppleButtonProps, "provider">;

function GoogleSocialAuthButton({ onSuccess, onError, className = "", text = "Continue with Google" }: GoogleSocialAuthButtonProps) {
  return (
    <div className={`relative w-full ${className}`}>
      <button
        type="button"
        className="w-full flex items-center justify-center gap-3 px-4 py-3 border-2 border-gray-300 rounded-lg hover:border-gray-400 transition-colors bg-white"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        <span className="font-medium text-slate-700">{text}</span>
      </button>
      <div className="absolute inset-0 opacity-0">
        <GoogleLogin
          onSuccess={onSuccess}
          onError={onError}
          type="standard"
          theme="outline"
          size="large"
          text="continue_with"
          shape="rectangular"
          logo_alignment="left"
          width={1}
          containerProps={{ className: "w-full h-full" }}
        />
      </div>
    </div>
  );
}

function AppleSocialAuthButton({ onClick, disabled, loading, label = "Continue with Apple", className = "" }: AppleSocialAuthButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      aria-label={label}
      aria-busy={loading ? true : undefined}
      className={`${appleButtonClassName} ${className}`}
    >
      <span aria-hidden="true" className="flex h-5 w-5 items-center justify-center">
        {loading ? (
          <Spinner />
        ) : (
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-white">
            <path d={APPLE_LOGO_PATH} />
          </svg>
        )}
      </span>
      <span className="text-center">{loading ? "Continuing..." : label}</span>
    </button>
  );
}

export function SocialAuthButton(props: SocialAuthButtonProps) {
  if (props.provider === "google") {
    const { onSuccess, onError, className, text } = props;
    return <GoogleSocialAuthButton onSuccess={onSuccess} onError={onError} className={className} text={text} />;
  }

  const { onClick, disabled, loading, label, className } = props;
  return <AppleSocialAuthButton onClick={onClick} disabled={disabled} loading={loading} label={label} className={className} />;
}