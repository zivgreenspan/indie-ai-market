import { createFileRoute, Outlet } from "@tanstack/react-router";

// Pure layout route: dashboard.products.index.tsx renders the
// "/dashboard/products" list page, and dashboard.products.new.tsx renders
// the new-product form. This file's only job is to let those nested
// routes actually mount via <Outlet />.
export const Route = createFileRoute("/_authenticated/dashboard/products")({
  component: () => <Outlet />,
});
