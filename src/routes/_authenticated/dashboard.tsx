import { createFileRoute, Outlet } from "@tanstack/react-router";

// Pure layout route: dashboard.index.tsx renders the "/dashboard" home
// page itself, and dashboard.products.tsx / dashboard.products.new.tsx
// render their own pages. This file's only job is to let those nested
// routes actually mount via <Outlet />.
export const Route = createFileRoute("/_authenticated/dashboard")({
  component: () => <Outlet />,
});
