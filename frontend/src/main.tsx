import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const shouldRegisterServiceWorker = import.meta.env.PROD && import.meta.env.VITE_ENABLE_SW !== "false";

if ("serviceWorker" in navigator && shouldRegisterServiceWorker) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        registration.update();
      })
      .catch((error) => console.error("Service worker registration failed", error));
  });
} else if (!import.meta.env.PROD) {
  console.info("Service worker disabled in development to avoid stale cache");
}

createRoot(document.getElementById("root")!).render(<App />);
