import { request } from "./core";

export const authApi = {
  signup: (input: { fullName: string; email: string; password: string; referralCode?: string }) =>
    request<{
      user: { id: string; email: string; emailVerifiedAt: string | null; fullName: string; username: string | null; role: string; status: string };
      expiresIn: string;
    }>("/auth/signup", { method: "POST", body: input, auth: false }),
  login: (input: { email: string; password: string }) =>
    request<{
      user: { id: string; email: string; emailVerifiedAt: string | null; fullName: string; username: string | null; role: string; status: string };
      expiresIn: string;
    }>("/auth/login", { method: "POST", body: input, auth: false }),
  google: (input: { idToken: string; referralCode?: string }) =>
    request<{
      user: { id: string; email: string; emailVerifiedAt: string | null; fullName: string; username: string | null; role: string; status: string };
      expiresIn: string;
    }>("/auth/google", { method: "POST", body: input, auth: false }),
  me: () =>
    request<{
      id: string;
      role: string;
      fullName: string;
      email: string;
      emailVerifiedAt: string | null;
      username: string | null;
      plan: string | null;
      status: string;
      leadFeatures?: {
        plan: string;
        filters: boolean;
        export: boolean;
        reminders: boolean;
        historyDays: number;
        maxVisibleLeads: number;
        advancedAnalytics: boolean;
        templatePack: string;
        templateLimit: number;
        channels: {
          whatsapp: boolean;
          email: boolean;
        };
        upgradeTarget: string | null;
      };
      planFeatures?: {
        teamSectionTools: boolean;
      };
    }>("/auth/me"),
  forgotPassword: (input: { email: string }) =>
    request<{ message: string }>("/auth/forgot-password", { method: "POST", body: input, auth: false }),
  resetPassword: (input: { token: string; newPassword: string }) =>
    request<{ message: string }>("/auth/reset-password", { method: "POST", body: input, auth: false }),
  verifyEmail: (input: { token: string }) =>
    request<{ message: string }>("/auth/verify-email", { method: "POST", body: input, auth: false }),
  resendVerification: (input: { email?: string }) =>
    request<{ message: string }>("/auth/resend-verification", { method: "POST", body: input, auth: false }),
  changePassword: (input: { currentPassword?: string; newPassword: string }) =>
    request<{ message: string }>("/users/change-password", { method: "POST", body: input }),
  deleteAccount: (input: { password?: string; confirmation: "DELETE" }) =>
    request<{ deleted: boolean; message: string }>("/users/account", { method: "DELETE", body: input }),
  refresh: () =>
    request<{ expiresIn: string }>("/auth/refresh", {
      method: "POST",
      body: {},
      auth: false,
    }),
  logout: () => request<{ message: string }>("/auth/logout", { method: "POST" }),
};

