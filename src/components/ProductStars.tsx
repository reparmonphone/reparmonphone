export default function ProductStars({
  rating,
  count,
  size = 'text-sm',
  showCount = true,
}: {
  rating: number | null;
  count: number;
  size?: string;
  showCount?: boolean;
}) {
  if (!rating || count === 0) return null;

  const rounded = Math.round(rating);
  return (
    <div className={`flex items-center gap-1.5 ${size}`}>
      <span className="text-amber-400">
        {'★'.repeat(rounded)}
        <span className="text-gray-200">{'★'.repeat(5 - rounded)}</span>
      </span>
      {showCount && <span className="text-gray-400">({count})</span>}
    </div>
  );
}
