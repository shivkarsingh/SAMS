export function Sparkline({ points, gradientId }) {
  const values = points.map((point) => point.value);
  const maxValue = Math.max(...values, 100);
  const minValue = Math.min(...values, 0);

  const coordinates = points.map((point, index) => {
    const x = (index / Math.max(points.length - 1, 1)) * 100;
    const y =
      100 - ((point.value - minValue) / Math.max(maxValue - minValue, 1)) * 100;

    return `${x},${y}`;
  });

  return (
    <svg
      className="sparkline"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>
      </defs>
      <polyline
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={coordinates.join(" ")}
      />
    </svg>
  );
}
