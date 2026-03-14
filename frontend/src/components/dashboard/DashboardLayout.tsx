// @ts-nocheck
import { ReactNode, Suspense, lazy, useState } from "react";
import { DashboardSidebar } from './DashboardSidebar';
import { DashboardHeader } from './DashboardHeader';
import { useOnboarding } from "../../features/onboarding/OnboardingContext";

const OnboardingModal = lazy(async () => {
  const module = await import("../../features/onboarding/OnboardingModal");
  return { default: module.OnboardingModal };
});

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isVisible: isOnboardingVisible } = useOnboarding();

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-200/70 via-cyan-100/60 to-sky-200/70">
      {/* Sidebar */}
      <DashboardSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      {/* Main Content */}
      <div className="lg:pl-64">
        <DashboardHeader onMenuClick={() => setSidebarOpen(true)} />
        
        <main className="p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>

      {isOnboardingVisible ? (
        <Suspense fallback={null}>
          <OnboardingModal />
        </Suspense>
      ) : null}
    </div>
  );
}


