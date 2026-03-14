import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Camera } from "lucide-react";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { FormInput, FormTextArea } from "../../components/ui/FormInput";
import { Dropdown } from "../../components/ui/Dropdown";
import { PUBLIC_APP_DOMAIN } from "../../lib/platform";
import { getUsernamePreviewReasonMessage } from "../../lib/usernames";
import { useOnboarding } from "./OnboardingContext";
import { OnboardingStepper } from "./OnboardingStepper";

const lensayaDomain = PUBLIC_APP_DOMAIN;

type EmojiSelection = {
  native: string;
};

type EmojiPickerComponent = ComponentType<{
  data: unknown;
  previewPosition?: string;
  theme?: string;
  onEmojiSelect?: (emoji: EmojiSelection) => void;
}>;

export function OnboardingModal() {
  const navigate = useNavigate();
  const [skipConfirmOpen, setSkipConfirmOpen] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isEmojiPickerLoading, setIsEmojiPickerLoading] = useState(false);
  const [emojiData, setEmojiData] = useState<unknown>(null);
  const [EmojiPicker, setEmojiPicker] = useState<EmojiPickerComponent | null>(null);
  const emojiPickerRef = useRef<HTMLDivElement | null>(null);
  const {
    isVisible,
    step,
    totalSteps,
    isSubmitting,
    stepError,
    profile,
    service,
    packageData,
    upload,
    services,
    setProfile,
    setService,
    setPackageData,
    setUpload,
    startSetup,
    goBack,
    skipOnboarding,
    submitCurrentStep,
    finishOnboarding,
    portfolioPath,
    usernamePreview,
  } = useOnboarding();

  useEffect(() => {
    if (!showEmojiPicker) return;

    const handleMouseDown = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showEmojiPicker]);

  useEffect(() => {
    if (step !== 2) {
      setShowEmojiPicker(false);
    }
  }, [step]);

  useEffect(() => {
    if (!showEmojiPicker) return;
    if (EmojiPicker && emojiData) return;

    let cancelled = false;
    setIsEmojiPickerLoading(true);

    void Promise.all([import("@emoji-mart/react"), import("@emoji-mart/data/sets/15/native.json")])
      .then(([pickerModule, dataModule]) => {
        if (cancelled) return;
        setEmojiPicker(() => pickerModule.default as EmojiPickerComponent);
        setEmojiData(dataModule.default ?? dataModule);
      })
      .catch(() => {
        if (cancelled) return;
        setEmojiPicker(null);
        setEmojiData(null);
      })
      .finally(() => {
        if (cancelled) return;
        setIsEmojiPickerLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [EmojiPicker, emojiData, showEmojiPicker]);

  const serviceOptions = useMemo(
    () => [
      { value: "", label: "Select service" },
      ...services.map((item) => ({
        value: item.id,
        label: item.name,
      })),
    ],
    [services]
  );

  if (!isVisible) return null;

  const currentProgressStep = step === 0 ? 1 : Math.min(step + 1, totalSteps);
  const uploadCount = upload.files.length;
  const generatedUsername = usernamePreview.username || "yourstudio";
  const usernamePreviewMessage = usernamePreview.isEmpty
    ? "Your pages username will be generated automatically from your studio name."
    : usernamePreview.isChecking
      ? "Checking pages username availability..."
      : usernamePreview.error
        ? usernamePreview.error
        : usernamePreview.available
          ? "Available. This will be your public pages URL."
          : getUsernamePreviewReasonMessage(usernamePreview.reason) ||
            "This studio name is unavailable. Please choose a different studio name.";
  const usernamePreviewClass = usernamePreview.isEmpty
    ? "border-gray-200 bg-slate-50 text-slate-700"
    : usernamePreview.error || !usernamePreview.available
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-green-200 bg-green-50 text-green-700";

  return (
    <Modal
      open={isVisible}
      title="Set up your Lensaya account"
      onClose={() => {
        // Keep onboarding controlled through explicit actions.
      }}
      footer={
        step === 5 ? (
          <div className="flex flex-col sm:flex-row justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                finishOnboarding();
                navigate("/dashboard", { replace: true });
              }}
            >
              Go to Dashboard
            </Button>
            <Button
              onClick={() => {
                finishOnboarding();
                navigate(portfolioPath, { replace: true });
              }}
            >
              View Pages
            </Button>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row justify-between gap-3">
            <div className="flex gap-2">
              {step > 0 ? (
                <Button variant="secondary" onClick={goBack} disabled={isSubmitting}>
                  Back
                </Button>
              ) : null}
              <Button
                variant="ghost"
                onClick={() => {
                  setSkipConfirmOpen(true);
                }}
                disabled={isSubmitting}
              >
                Skip for now
              </Button>
            </div>

            {step === 0 ? (
              <Button onClick={startSetup}>Start Setup</Button>
            ) : (
              <Button onClick={() => void submitCurrentStep()} disabled={isSubmitting || (step === 1 && usernamePreview.isChecking)}>
                {isSubmitting ? "Saving..." : step === 4 ? "Complete Setup" : "Continue"}
              </Button>
            )}
          </div>
        )
      }
    >
      {step < 5 ? <OnboardingStepper currentStep={currentProgressStep} totalSteps={totalSteps} /> : null}

      {step === 0 ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Welcome to Lensaya</h3>
              <p className="text-sm text-slate-600">Build your pages, add services, and receive bookings.</p>
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-slate-50 p-4 text-sm text-slate-700">
            This guided setup helps you publish your first photographer site in a few minutes.
          </div>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="space-y-4">
          <FormInput
            label="Studio Name"
            value={profile.studioName}
            onChange={(event) => setProfile({ ...profile, studioName: event.target.value })}
            placeholder="Ray Studio Shah Alam"
            hint="Your pages username is generated automatically from your studio name."
          />
          <div className={`rounded-xl border p-4 ${usernamePreviewClass}`}>
            <p className="text-xs font-semibold uppercase tracking-wide">Generated Pages Username</p>
            <p className="mt-1 text-base font-semibold">{generatedUsername}.{lensayaDomain}</p>
            <p className="mt-2 text-xs">{usernamePreviewMessage}</p>
          </div>
          <div>
            <label htmlFor="onboarding-phone" className="block text-sm font-medium text-slate-700 mb-1">
              Phone Number
            </label>
            <PhoneInput
              id="onboarding-phone"
              defaultCountry="MY"
              international
              withCountryCallingCode
              countryCallingCodeEditable={false}
              value={profile.phone}
              onChange={(value) => setProfile({ ...profile, phone: value || "" })}
              className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white focus-within:ring-2 focus-within:ring-cyan-500 focus-within:border-cyan-500 transition-all"
            />
            <p className="mt-1 text-xs text-slate-500">Stored as international format (for example +60123456789).</p>
          </div>
          <FormInput
            label="Instagram (optional)"
            value={profile.instagram}
            onChange={(event) => setProfile({ ...profile, instagram: event.target.value })}
            placeholder="@johnstudio"
          />
          <FormInput
            label="Facebook (optional)"
            value={profile.facebook}
            onChange={(event) => setProfile({ ...profile, facebook: event.target.value })}
            placeholder="johnstudio"
          />
          <FormInput
            label="TikTok (optional)"
            value={profile.tiktok}
            onChange={(event) => setProfile({ ...profile, tiktok: event.target.value })}
            placeholder="@johnstudio"
          />
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-cyan-100 bg-cyan-50/60 p-3">
            <p className="text-sm font-medium text-slate-900">What type of service do you offer?</p>
            <p className="mt-1 text-xs text-slate-600">
              A service is a category of work clients can book from you. Examples: Wedding Photography, Convocation, Portrait
              Session, Event Coverage.
            </p>
          </div>
          <FormInput
            label="Service Name"
            value={service.name}
            onChange={(event) => setService({ ...service, name: event.target.value })}
            placeholder="Wedding Photography"
            hint="Example: Wedding Photography, Convocation, Family Portrait"
          />
          <FormTextArea
            label="Description"
            value={service.description}
            onChange={(event) => setService({ ...service, description: event.target.value })}
            rows={4}
            placeholder="Capture your once-in-a-lifetime wedding moments."
          />
          <div className="relative" ref={emojiPickerRef}>
            <label className="block text-sm font-medium text-slate-700 mb-1">Emoji / Icon (optional)</label>
            <button
              type="button"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-left hover:border-cyan-400 transition-colors"
              onClick={() => setShowEmojiPicker((current) => !current)}
            >
              <span className="inline-flex items-center gap-3">
                <span className="text-2xl leading-none">{service.emoji || "??"}</span>
                <span className="text-sm text-slate-600">{service.emoji ? "Change emoji" : "Select an emoji"}</span>
              </span>
            </button>
            <p className="mt-1 text-xs text-slate-500">Pick an icon to help clients quickly recognize this service.</p>

            {showEmojiPicker ? (
              <div className="absolute z-[80] mt-2">
                {EmojiPicker && emojiData ? (
                  <EmojiPicker
                    data={emojiData}
                    previewPosition="none"
                    theme="light"
                    onEmojiSelect={(emoji: EmojiSelection) => {
                      setService({ ...service, emoji: emoji.native });
                      setShowEmojiPicker(false);
                    }}
                  />
                ) : (
                  <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-lg">
                    {isEmojiPickerLoading ? "Loading emoji picker..." : "Unable to load emoji picker."}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-4">
          <Dropdown
            label="Service"
            value={packageData.serviceId}
            onChange={(event) => setPackageData({ ...packageData, serviceId: event.target.value })}
            options={serviceOptions}
          />
          <FormInput
            label="Package Name"
            value={packageData.name}
            onChange={(event) => setPackageData({ ...packageData, name: event.target.value })}
            placeholder="Essential Wedding Package"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput
              label="Price"
              type="number"
              min={0}
              step="0.01"
              value={packageData.price}
              onChange={(event) => setPackageData({ ...packageData, price: event.target.value })}
              placeholder="1500"
            />
            <FormInput
              label="Duration"
              value={packageData.duration}
              onChange={(event) => setPackageData({ ...packageData, duration: event.target.value })}
              placeholder="6 hours"
              hint="Example: 2 hours, 4 hours, half day, full day"
            />
          </div>
          <FormTextArea
            label="Features (one per line)"
            value={packageData.featuresText}
            onChange={(event) => setPackageData({ ...packageData, featuresText: event.target.value })}
            rows={4}
            placeholder={"500 edited photos\nOnline gallery\nHighlight reel"}
          />
        </div>
      ) : null}

      {step === 4 ? (
        <div className="space-y-4">
          <Dropdown
            label="Service (optional)"
            value={upload.serviceId}
            onChange={(event) => setUpload({ ...upload, serviceId: event.target.value })}
            options={[{ value: "", label: "No service" }, ...serviceOptions.filter((item) => item.value)]}
          />
          <FormInput
            label="Category (optional)"
            value={upload.category}
            onChange={(event) => setUpload({ ...upload, category: event.target.value })}
            placeholder="Wedding"
          />
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={upload.featured}
              onChange={(event) => setUpload({ ...upload, featured: event.target.checked })}
            />
            Mark uploads as featured
          </label>

          <label className="block">
            <span className="block text-sm font-medium text-slate-700 mb-1">Upload Page Images</span>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(event) =>
                setUpload({
                  ...upload,
                  files: Array.from(event.target.files || []),
                })
              }
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
            />
            <span className="block mt-1 text-xs text-slate-500">
              {uploadCount === 0 ? "No files selected" : `${uploadCount} file(s) selected`}
            </span>
          </label>
        </div>
      ) : null}

      {step === 5 ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-50 text-green-600 flex items-center justify-center">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Your pages are ready!</h3>
              <p className="text-sm text-slate-600">You can now manage your dashboard and share your public pages.</p>
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-slate-50 p-4 text-sm text-slate-700">
            Public URL preview:{" "}
            <span className="font-medium text-cyan-700">
              {generatedUsername}.{lensayaDomain}
            </span>
          </div>
        </div>
      ) : null}

      {stepError ? (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {stepError}
        </p>
      ) : null}

      <Modal
        open={skipConfirmOpen}
        title="Skip setup?"
        onClose={() => {
          setSkipConfirmOpen(false);
        }}
        panelClassName="max-w-lg"
        footer={
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setSkipConfirmOpen(false);
              }}
            >
              Continue Setup
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={() => {
                setSkipConfirmOpen(false);
                skipOnboarding();
              }}
            >
              Skip Anyway
            </Button>
          </div>
        }
      >
        <p className="text-sm text-slate-700 mb-3">Are you sure you want to skip setup?</p>
        <p className="text-sm text-slate-700 mb-2">Your pages will not be visible until you:</p>
        <ul className="list-disc list-inside text-sm text-slate-700 space-y-1">
          <li>create a service</li>
          <li>create a package</li>
          <li>upload page photos</li>
        </ul>
      </Modal>
    </Modal>
  );
}




