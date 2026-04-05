export function AppBrand({ href = "#/", subtitle = "Smart Attendance Management" }) {
  return (
    <a className="brand" href={href}>
      <span className="brand-mark">S</span>
      <span className="brand-copy">
        <strong>SAMS</strong>
        <small>{subtitle}</small>
      </span>
    </a>
  );
}

