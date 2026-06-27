export function formatPrice(
  cents: number | null | undefined,
  currency = "usd",
  pricingModel: "one_time" | "subscription" = "one_time",
): string {
  if (cents === null || cents === undefined) return "—";
  if (cents === 0) return "Free";
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  });
  const base = formatter.format(cents / 100);
  return pricingModel === "subscription" ? `${base}/mo` : base;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}
