import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MantineProvider, createTheme, type CSSVariablesResolver } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "./styles/global.scss";
import "./styles/components/notifications.scss";
import App from "./App";

const theme = createTheme({
  primaryColor: "teal",
  fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  headings: {
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
});

// Contrast fixes (axe `color-contrast`, serious — run-1c): the Mantine defaults
// fail WCAG AA on the white body — anchor teal-6 #12b886 is 2.55:1, dimmed gray-6
// #868e96 is 3.32:1; teal-9 = 5.0:1 and gray-7 = 8.2:1 pass. Must go through the
// provider's own var resolver — its injected <style> outranks any stylesheet.
const contrastVars: CSSVariablesResolver = () => ({
  variables: {},
  light: {
    "--mantine-color-anchor": "var(--mantine-color-teal-9)",
    "--mantine-color-dimmed": "var(--mantine-color-gray-7)",
  },
  dark: {},
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MantineProvider theme={theme} cssVariablesResolver={contrastVars}>
      <Notifications position="bottom-right" />
      <App />
    </MantineProvider>
  </StrictMode>
);
