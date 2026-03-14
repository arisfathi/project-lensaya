import React from "react";
import ReactDOM from "react-dom/client";
import { GoogleOAuthProvider } from "@react-oauth/google";
import "./tailwind.generated.css";
import App from "./App";
import { initRuntimeErrorMonitoring } from "./lib/monitoring";

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

initRuntimeErrorMonitoring();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {googleClientId ? (
      <GoogleOAuthProvider clientId={googleClientId}>
        <App />
      </GoogleOAuthProvider>
    ) : (
      <App />
    )}
  </React.StrictMode>,
);
