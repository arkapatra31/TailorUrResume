import "@fontsource-variable/inter";
import "@fontsource-variable/source-serif-4";
import { MotionConfig } from "framer-motion";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <ErrorBoundary><App /></ErrorBoundary>
    </MotionConfig>
  </StrictMode>,
);
