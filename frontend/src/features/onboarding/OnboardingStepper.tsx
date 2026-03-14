type OnboardingStepperProps = {
  currentStep: number;
  totalSteps: number;
};

export function OnboardingStepper({ currentStep, totalSteps }: OnboardingStepperProps) {
  const safeCurrent = Math.max(1, Math.min(currentStep, totalSteps));
  const progress = Math.round((safeCurrent / totalSteps) * 100);

  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-slate-700">
          Step {safeCurrent} / {totalSteps}
        </p>
        <p className="text-xs text-slate-500">{progress}%</p>
      </div>
      <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
        <div className="h-full bg-cyan-500 transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
