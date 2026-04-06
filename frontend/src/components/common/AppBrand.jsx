export function AppBrand({ href = "#/", subtitle = "Smart Attendance Management" }) {
  return (
    <a className="brand" href={href}>
      <span className="brand-mark">M</span>
      <span className="brand-copy">
        <strong>MarkIn</strong>
        <small>{subtitle}</small>
      </span>
    </a>
  );
}
