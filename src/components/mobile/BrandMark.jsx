import logo from '../../assets/klg-logo.png';

export default function BrandMark({ size = 40 }) {
  return <img className="brand-mark" src={logo} width={size} height={size} alt="" aria-hidden="true" draggable="false" />;
}
