import { RouterProvider } from 'react-router-dom';
import { router } from './routes';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { OnboardingProvider } from './features/onboarding/OnboardingContext';
import { ReferralCodePersistence } from './components/routing/ReferralCodePersistence';

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <OnboardingProvider>
          <ReferralCodePersistence />
          <RouterProvider router={router} />
        </OnboardingProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
