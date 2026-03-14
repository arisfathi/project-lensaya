/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import {
  getApiErrorMessage,
  packagesApi,
  portfolioApi,
  profileApi,
  servicesApi,
  uploadsApi,
} from "../../lib/api";
import { useStudioUsernamePreview, type StudioUsernamePreview } from "../../hooks/useStudioUsernamePreview";
import { getUsernamePreviewReasonMessage } from "../../lib/usernames";

type ServiceOption = {
  id: string;
  name: string;
};

type ProfileStepData = {
  studioName: string;
  phone: string;
  instagram: string;
  facebook: string;
  tiktok: string;
};

type ServiceStepData = {
  name: string;
  description: string;
  emoji: string;
};

type PackageStepData = {
  serviceId: string;
  name: string;
  price: string;
  duration: string;
  featuresText: string;
};

type UploadStepData = {
  serviceId: string;
  category: string;
  featured: boolean;
  files: File[];
};

type OnboardingStep = 0 | 1 | 2 | 3 | 4 | 5;

type OnboardingContextValue = {
  isVisible: boolean;
  isChecking: boolean;
  isSubmitting: boolean;
  step: OnboardingStep;
  totalSteps: number;
  stepError: string | null;
  profile: ProfileStepData;
  service: ServiceStepData;
  packageData: PackageStepData;
  upload: UploadStepData;
  services: ServiceOption[];
  portfolioPath: string;
  usernamePreview: StudioUsernamePreview;
  setProfile: (next: ProfileStepData) => void;
  setService: (next: ServiceStepData) => void;
  setPackageData: (next: PackageStepData) => void;
  setUpload: (next: UploadStepData) => void;
  startSetup: () => void;
  goBack: () => void;
  skipOnboarding: () => void;
  submitCurrentStep: () => Promise<void>;
  finishOnboarding: () => void;
};

const OnboardingContext = createContext<OnboardingContextValue | undefined>(undefined);

const ONBOARDING_COMPLETED_PREFIX = "lensaya_onboarding_completed_";
const ONBOARDING_DRAFT_PREFIX = "lensaya_onboarding_draft_";

const defaultProfile: ProfileStepData = {
  studioName: "",
  phone: "",
  instagram: "",
  facebook: "",
  tiktok: "",
};

const defaultService: ServiceStepData = {
  name: "",
  description: "",
  emoji: "",
};

const defaultPackage: PackageStepData = {
  serviceId: "",
  name: "",
  price: "",
  duration: "",
  featuresText: "",
};

const defaultUpload: UploadStepData = {
  serviceId: "",
  category: "",
  featured: false,
  files: [],
};

type DraftState = {
  step: OnboardingStep;
  profile: ProfileStepData;
  service: ServiceStepData;
  packageData: PackageStepData;
  upload: Omit<UploadStepData, "files">;
};

const toCompletedKey = (userId: string) => `${ONBOARDING_COMPLETED_PREFIX}${userId}`;
const toDraftKey = (userId: string) => `${ONBOARDING_DRAFT_PREFIX}${userId}`;

const parseDraft = (raw: string | null): DraftState | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DraftState;
  } catch {
    return null;
  }
};

const normalizePhoneNumber = (value: string | null | undefined) => {
  const digits = String(value || "").replace(/\D/g, "");
  return digits ? `+${digits}` : "";
};

let phoneValidationModulePromise: Promise<typeof import("react-phone-number-input")> | null = null;

const validatePhoneNumber = async (value: string) => {
  const normalized = String(value || "").trim();
  if (!normalized) return false;

  try {
    if (!phoneValidationModulePromise) {
      phoneValidationModulePromise = import("react-phone-number-input");
    }

    const module = await phoneValidationModulePromise;
    if (typeof module.isValidPhoneNumber === "function") {
      return Boolean(module.isValidPhoneNumber(normalized));
    }
  } catch {
    // Fallback below keeps onboarding functional even if dynamic import fails.
  }

  return /^\+\d{8,15}$/.test(normalized);
};

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isBootstrapping, refreshUser } = useAuth();
  const { success, error, info } = useToast();

  const [isChecking, setIsChecking] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<OnboardingStep>(0);
  const [stepError, setStepError] = useState<string | null>(null);

  const [profile, setProfile] = useState<ProfileStepData>(defaultProfile);
  const [service, setService] = useState<ServiceStepData>(defaultService);
  const [packageData, setPackageData] = useState<PackageStepData>(defaultPackage);
  const [upload, setUpload] = useState<UploadStepData>(defaultUpload);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const usernamePreview = useStudioUsernamePreview(profile.studioName);

  const loadServices = useCallback(async () => {
    const result = await servicesApi.list();
    const items = (result.items || []) as Array<{ id?: string; name?: string }>;
    const mapped = items
      .filter((item): item is { id: string; name: string } => Boolean(item.id && item.name))
      .map((item) => ({ id: item.id, name: item.name }));
    setServices(mapped);
    return mapped;
  }, []);

  const markCompleted = useCallback(() => {
    if (!user?.id) return;
    window.localStorage.setItem(toCompletedKey(user.id), "1");
    window.localStorage.removeItem(toDraftKey(user.id));
  }, [user?.id]);

  const skipOnboarding = useCallback(() => {
    markCompleted();
    setIsVisible(false);
    info("Onboarding skipped. You can finish setup later from your dashboard.");
  }, [info, markCompleted]);

  const finishOnboarding = useCallback(() => {
    markCompleted();
    setIsVisible(false);
  }, [markCompleted]);

  useEffect(() => {
    if (!user?.id) return;
    if (!isVisible) return;

    const draft: DraftState = {
      step,
      profile,
      service,
      packageData,
      upload: {
        serviceId: upload.serviceId,
        category: upload.category,
        featured: upload.featured,
      },
    };
    window.localStorage.setItem(toDraftKey(user.id), JSON.stringify(draft));
  }, [isVisible, packageData, profile, service, step, upload.category, upload.featured, upload.serviceId, user?.id]);

  useEffect(() => {
    let mounted = true;

    const checkOnboarding = async () => {
      if (isBootstrapping) return;
      if (!isAuthenticated || !user || user.role !== "PHOTOGRAPHER") {
        setIsVisible(false);
        return;
      }

      const completedKey = toCompletedKey(user.id);
      const draftKey = toDraftKey(user.id);

      if (window.localStorage.getItem(completedKey) === "1") {
        setIsVisible(false);
        return;
      }

      setIsChecking(true);
      try {
        const draft = parseDraft(window.localStorage.getItem(draftKey));

        let fetchedProfile: {
          studioName?: string | null;
          username?: string | null;
          socialLinks?: { whatsapp?: string; instagram?: string; facebook?: string; tiktok?: string };
        } | null = null;

        try {
          fetchedProfile = await profileApi.get();
        } catch {
          fetchedProfile = null;
        }

        const [servicesResult, packagesResult, portfolioResult] = await Promise.all([
          servicesApi.list().catch(() => ({ items: [] })),
          packagesApi.list().catch(() => ({ items: [] })),
          portfolioApi.list().catch(() => ({ items: [] })),
        ]);

        if (!mounted) return;

        const serviceItems = ((servicesResult.items || []) as Array<{ id?: string; name?: string }>)
          .filter((item): item is { id: string; name: string } => Boolean(item.id && item.name))
          .map((item) => ({ id: item.id, name: item.name }));

        setServices(serviceItems);

        const profileState: ProfileStepData = {
          studioName: draft?.profile.studioName || fetchedProfile?.studioName || "",
          phone: normalizePhoneNumber(draft?.profile.phone || fetchedProfile?.socialLinks?.whatsapp || ""),
          instagram: draft?.profile.instagram || fetchedProfile?.socialLinks?.instagram || "",
          facebook: draft?.profile.facebook || fetchedProfile?.socialLinks?.facebook || "",
          tiktok: draft?.profile.tiktok || fetchedProfile?.socialLinks?.tiktok || "",
        };

        const serviceState: ServiceStepData = draft?.service || defaultService;
        const packageState: PackageStepData = {
          ...(draft?.packageData || defaultPackage),
          serviceId:
            draft?.packageData.serviceId ||
            serviceItems[0]?.id ||
            "",
        };

        const uploadState: UploadStepData = {
          ...defaultUpload,
          ...(draft?.upload || {}),
          files: [],
          serviceId: draft?.upload.serviceId || serviceItems[0]?.id || "",
        };

        setProfile(profileState);
        setService(serviceState);
        setPackageData(packageState);
        setUpload(uploadState);

        const hasProfile =
          Boolean(profileState.studioName.trim()) &&
          Boolean(profileState.phone.trim());
        const hasServices = ((servicesResult.items || []) as unknown[]).length > 0;
        const hasPackages = ((packagesResult.items || []) as unknown[]).length > 0;
        const hasPortfolio = ((portfolioResult.items || []) as unknown[]).length > 0;

        let startingStep: OnboardingStep = 0;
        if (!hasProfile) {
          startingStep = 1;
        } else if (!hasServices) {
          startingStep = 2;
        } else if (!hasPackages) {
          startingStep = 3;
        } else if (!hasPortfolio) {
          startingStep = 4;
        } else {
          markCompleted();
          setIsVisible(false);
          return;
        }

        setStep(draft ? startingStep : 0);
        setStepError(null);
        setIsVisible(true);
      } finally {
        if (mounted) {
          setIsChecking(false);
        }
      }
    };

    void checkOnboarding();

    return () => {
      mounted = false;
    };
  }, [isAuthenticated, isBootstrapping, markCompleted, user]);

  const submitProfile = useCallback(async () => {
    if (profile.studioName.trim().length < 2) {
      setStepError("Studio name must be at least 2 characters.");
      return;
    }
    if (!profile.phone.trim()) {
      setStepError("Phone number is required.");
      return;
    }
    const normalizedPhone = normalizePhoneNumber(profile.phone);
    const phoneValid = normalizedPhone ? await validatePhoneNumber(normalizedPhone) : false;
    if (!phoneValid) {
      setStepError("Please enter a valid phone number.");
      return;
    }
    if (usernamePreview.isChecking) {
      setStepError("Checking pages username availability. Please wait.");
      return;
    }
    if (usernamePreview.error) {
      setStepError(usernamePreview.error);
      return;
    }
    if (!usernamePreview.username || !usernamePreview.available) {
      setStepError(
        getUsernamePreviewReasonMessage(usernamePreview.reason) ||
          "This studio name is unavailable. Please choose a different studio name."
      );
      return;
    }
    const instagram = profile.instagram.trim();
    const facebook = profile.facebook.trim();
    const tiktok = profile.tiktok.trim();

    await profileApi.update({
      studioName: profile.studioName.trim(),
      socialLinks: {
        whatsapp: normalizedPhone,
        instagram: instagram || undefined,
        facebook: facebook || undefined,
        tiktok: tiktok || undefined,
      },
    });
    await refreshUser();

    setStepError(null);
    setStep(2);
    success("Profile saved.");
  }, [profile, refreshUser, success, usernamePreview]);

  const submitService = useCallback(async () => {
    if (!service.name.trim()) {
      setStepError("Service name is required.");
      return;
    }

    const result = await servicesApi.create({
      name: service.name.trim(),
      description: service.description.trim() || undefined,
      emoji: service.emoji.trim() || undefined,
      order: 0,
    });

    const created = (result.service || {}) as { id?: string; name?: string };
    setStepError(null);

    const refreshed = await loadServices();
    const selectedServiceId = created.id || refreshed[0]?.id || "";

    setPackageData((current) => ({
      ...current,
      serviceId: current.serviceId || selectedServiceId,
    }));
    setUpload((current) => ({
      ...current,
      serviceId: current.serviceId || selectedServiceId,
    }));

    setStep(3);
    success("First service created.");
  }, [loadServices, service, success]);

  const submitPackage = useCallback(async () => {
    const serviceId = packageData.serviceId || services[0]?.id || "";
    if (!serviceId) {
      setStepError("Create a service before creating a package.");
      return;
    }
    if (!packageData.name.trim()) {
      setStepError("Package name is required.");
      return;
    }
    const price = Number(packageData.price);
    if (!Number.isFinite(price) || price < 0) {
      setStepError("Price must be a valid non-negative number.");
      return;
    }
    if (!packageData.duration.trim()) {
      setStepError("Duration is required.");
      return;
    }

    const features = packageData.featuresText
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);

    await packagesApi.create({
      serviceId,
      name: packageData.name.trim(),
      price,
      duration: packageData.duration.trim(),
      features,
      popular: false,
    });

    setStepError(null);
    setUpload((current) => ({
      ...current,
      serviceId: current.serviceId || serviceId,
    }));
    setStep(4);
    success("First package created.");
  }, [packageData, services, success]);

  const submitUploads = useCallback(async () => {
    if (upload.files.length === 0) {
      setStepError("Upload at least one page image.");
      return;
    }

    const serviceId = upload.serviceId || services[0]?.id || undefined;

    for (const file of upload.files) {
      if (!file.type.startsWith("image/")) {
        throw new Error(`Unsupported file type: ${file.name}`);
      }

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
        throw new Error(`Failed to upload ${file.name}`);
      }

      await uploadsApi.complete(presigned.assetId);

      await portfolioApi.create({
        imageAssetId: presigned.assetId,
        serviceId,
        category: upload.category.trim() || undefined,
        featured: upload.featured,
      });
    }

    setStepError(null);
    setStep(5);
    markCompleted();
    success("Pages uploaded. Your site is ready.");
  }, [markCompleted, services, success, upload]);

  const submitCurrentStep = useCallback(async () => {
    setIsSubmitting(true);
    try {
      if (step === 0) {
        setStep(1);
        setStepError(null);
        return;
      }
      if (step === 1) {
        await submitProfile();
        return;
      }
      if (step === 2) {
        await submitService();
        return;
      }
      if (step === 3) {
        await submitPackage();
        return;
      }
      if (step === 4) {
        await submitUploads();
      }
    } catch (err) {
      const message = getApiErrorMessage(err, "Failed to continue onboarding");
      setStepError(message);
      error(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [error, step, submitPackage, submitProfile, submitService, submitUploads]);

  const startSetup = useCallback(() => {
    setStep(1);
    setStepError(null);
  }, []);

  const goBack = useCallback(() => {
    setStep((current) => {
      if (current <= 0) return current;
      if (current === 5) return 4;
      return (current - 1) as OnboardingStep;
    });
    setStepError(null);
  }, []);

  const portfolioPath = useMemo(() => {
    const username = usernamePreview.username || user?.username || "";
    if (!username) return "/portfolio";
    return "/p/" + username;
  }, [user?.username, usernamePreview.username]);

  const value = useMemo<OnboardingContextValue>(
    () => ({
      isVisible,
      isChecking,
      isSubmitting,
      step,
      totalSteps: 5,
      stepError,
      profile,
      service,
      packageData,
      upload,
      services,
      portfolioPath,
      usernamePreview,
      setProfile,
      setService,
      setPackageData,
      setUpload,
      startSetup,
      goBack,
      skipOnboarding,
      submitCurrentStep,
      finishOnboarding,
    }),
    [
      finishOnboarding,
      goBack,
      isChecking,
      isSubmitting,
      isVisible,
      packageData,
      portfolioPath,
      profile,
      service,
      skipOnboarding,
      startSetup,
      step,
      stepError,
      submitCurrentStep,
      upload,
      services,
      usernamePreview,
    ]
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error("useOnboarding must be used within OnboardingProvider");
  }
  return context;
}

