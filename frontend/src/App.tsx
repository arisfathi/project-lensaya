import { RouterProvider } from 'react-router-dom';
import { router } from './routes';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { OnboardingProvider } from './features/onboarding/OnboardingContext';

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <OnboardingProvider>
          <RouterProvider router={router} />
        </OnboardingProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
