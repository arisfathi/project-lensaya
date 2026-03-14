import { useEffect, useState } from "react";
import { getApiErrorMessage, profileApi } from "../lib/api";
import {
  USERNAME_PREVIEW_MIN_LENGTH,
  normalizeUsernameSeed,
  type UsernamePreviewReason,
} from "../lib/usernames";

export type StudioUsernamePreview = {
  studioName: string;
  username: string;
  available: boolean;
  reason: UsernamePreviewReason;
  isChecking: boolean;
  hasChecked: boolean;
  isEmpty: boolean;
  error: string | null;
};

const createPreviewState = (
  studioName: string,
  username: string,
  overrides: Partial<StudioUsernamePreview> = {}
): StudioUsernamePreview => ({
  studioName,
  username,
  available: false,
  reason: null,
  isChecking: false,
  hasChecked: false,
  isEmpty: false,
  error: null,
  ...overrides,
});

export function useStudioUsernamePreview(studioName: string) {
  const [preview, setPreview] = useState<StudioUsernamePreview>(() =>
    createPreviewState("", "", { isEmpty: true })
  );

  useEffect(() => {
    const trimmedStudioName = String(studioName || "").trim();
    const localUsername = normalizeUsernameSeed(trimmedStudioName);

    if (!trimmedStudioName) {
      setPreview(createPreviewState("", "", { isEmpty: true }));
      return undefined;
    }

    if (!localUsername) {
      setPreview(
        createPreviewState(trimmedStudioName, "", {
          reason: "invalid",
          hasChecked: true,
        })
      );
      return undefined;
    }

    if (localUsername.length < USERNAME_PREVIEW_MIN_LENGTH) {
      setPreview(
        createPreviewState(trimmedStudioName, localUsername, {
          reason: "too_short",
          hasChecked: true,
        })
      );
      return undefined;
    }

    let active = true;
    setPreview(
      createPreviewState(trimmedStudioName, localUsername, {
        isChecking: true,
      })
    );

    const timer = window.setTimeout(async () => {
      try {
        const result = await profileApi.usernamePreview(trimmedStudioName);
        if (!active) {
          return;
        }

        setPreview(
          createPreviewState(result.studioName || trimmedStudioName, result.username || localUsername, {
            available: Boolean(result.available),
            reason: (result.reason || null) as UsernamePreviewReason,
            hasChecked: true,
          })
        );
      } catch (error) {
        if (!active) {
          return;
        }

        setPreview(
          createPreviewState(trimmedStudioName, localUsername, {
            error: getApiErrorMessage(error, "Failed to check pages username availability"),
          })
        );
      }
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [studioName]);

  return preview;
}
