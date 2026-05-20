export function AppBrand({ href = "#/", subtitle = "Smart Attendance Management" }) {
  return (
    <a className="brand" href={href}>
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 48 48" role="img" focusable="false">
          <path
            className="brand-check-shadow"
            d="M14.5 25.3 21.2 32 34.6 17.1"
          />
          <path
            className="brand-check"
            d="M14.5 24.1 21.2 30.8 34.6 15.9"
          />
        </svg>
      </span>
      <span className="brand-copy">
        <strong>MarkIn</strong>
        <small>{subtitle}</small>
      </span>
    </a>
  );
}
