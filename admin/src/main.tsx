import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "@mantine/dates/styles.css";
import { createAdmin } from "@cms/admin-base";

// Webshop test bed. Commerce is ON here (this is the dev target for cms-ai-core's
// Phase L webshop roadmap) — `commerce: true` mounts the built-in commerce admin
// module (Categories from L1.2; Products/Orders/… as later phases land). Must
// match the API's COMMERCE_ENABLED=true (set in start.sh).
createAdmin({
  apiUrl: import.meta.env.VITE_API_URL,
  frontendUrl: import.meta.env.VITE_FRONTEND_URL,
  projectSlug: "project-webshop-template",
  commerce: true,
});
