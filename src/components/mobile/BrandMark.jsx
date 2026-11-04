export default function BrandMark({ size = 40 }) {
  return (
    <span className="brand-mark" style={{ width: size, height: size, fontSize: size * 0.34 }} aria-hidden="true">
      KLG
    </span>
  );
}
