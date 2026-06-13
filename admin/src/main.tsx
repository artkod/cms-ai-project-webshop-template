import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "@mantine/dates/styles.css";
import { createAdmin } from "@cms/admin-base";

// Minimal admin shell for the webshop test project. The commerce module
// (`createAdmin({ commerce: true })` + commerce block/page types) is wired in
// during Phase L of cms-ai-core's webshop roadmap (see docs/webshop-roadmap.md,
// task L0.1). For now this boots the stock CMS admin so the project is a valid,
// bootable test bed.
createAdmin({
  apiUrl: import.meta.env.VITE_API_URL,
  frontendUrl: import.meta.env.VITE_FRONTEND_URL,
  projectSlug: "project-webshop-template",
});
