export const CATEGORIES = [
  { value: "productivity", label: "Productivity" },
  { value: "creative_tools", label: "Creative tools" },
  { value: "developer_tools", label: "Developer tools" },
  { value: "finance", label: "Finance" },
  { value: "education", label: "Education" },
  { value: "other", label: "Other" },
] as const;

export type CategoryValue = (typeof CATEGORIES)[number]["value"];

export function categoryLabel(value: string | null | undefined): string {
  return CATEGORIES.find((c) => c.value === value)?.label ?? "Other";
}
