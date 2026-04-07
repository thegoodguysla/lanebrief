type TestimonialCardProps = {
  rating: number;
  text?: string | null;
  name: string;
  title?: string | null;
};

export function TestimonialCard({ rating, text, name, title }: TestimonialCardProps) {
  const stars = Array.from({ length: 5 }, (_, i) => i < rating);

  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3">
      <div className="flex gap-0.5" aria-label={`${rating} out of 5 stars`}>
        {stars.map((filled, i) => (
          <span key={i} className={filled ? "text-yellow-400" : "text-gray-200"} aria-hidden="true">
            ★
          </span>
        ))}
      </div>
      {text && (
        <p className="text-sm text-foreground leading-relaxed">
          &ldquo;{text}&rdquo;
        </p>
      )}
      <div className="mt-auto">
        <p className="text-sm font-semibold text-foreground">— {name}</p>
        {title && <p className="text-xs text-muted-foreground">{title}</p>}
      </div>
    </div>
  );
}

export function TestimonialPlaceholder() {
  return (
    <div className="bg-card border border-dashed border-border rounded-xl p-5 flex flex-col items-center justify-center gap-2 text-center min-h-[140px]">
      <div className="flex gap-0.5 text-gray-300" aria-hidden="true">
        {"★★★★★".split("").map((s, i) => <span key={i}>{s}</span>)}
      </div>
      <p className="text-sm text-muted-foreground">Be one of our first reviewers</p>
    </div>
  );
}
