import { Link } from "@tanstack/react-router";
import { categoryLabel } from "@/lib/categories";
import { formatPrice } from "@/lib/format";

export type ProductCardData = {
  id: string;
  slug: string;
  title: string;
  tagline: string | null;
  cover_image_url: string | null;
  category: string;
  price_cents: number;
  currency: string;
  pricing_model: "one_time" | "subscription";
  creator: {
    username: string;
    display_name: string;
    avatar_url: string | null;
  };
};

export function ProductCard({ product }: { product: ProductCardData }) {
  return (
    <Link
      to="/p/$username/$slug"
      params={{ username: product.creator.username, slug: product.slug }}
      className="group block overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-primary/40"
    >
      <div className="aspect-[16/10] overflow-hidden bg-surface-2">
        {product.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.cover_image_url}
            alt={product.title}
            className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            loading="lazy"
          />
        ) : (
          <div className="flex size-full items-center justify-center font-display text-4xl text-muted-foreground/40">
            {product.title.slice(0, 1)}
          </div>
        )}
      </div>
      <div className="space-y-3 p-4">
        <div className="flex items-center justify-between text-xs">
          <span className="rounded-full bg-surface-2 px-2 py-0.5 font-mono uppercase tracking-wide text-muted-foreground">
            {categoryLabel(product.category)}
          </span>
          <span className="font-mono text-foreground">
            {formatPrice(product.price_cents, product.currency, product.pricing_model)}
          </span>
        </div>
        <div>
          <h3 className="font-display text-base font-semibold leading-tight">{product.title}</h3>
          {product.tagline && (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{product.tagline}</p>
          )}
        </div>
        <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
          <span className="inline-flex size-5 items-center justify-center rounded-full bg-surface-2 font-mono">
            {product.creator.display_name.slice(0, 1).toUpperCase()}
          </span>
          <span>@{product.creator.username}</span>
        </div>
      </div>
    </Link>
  );
}
