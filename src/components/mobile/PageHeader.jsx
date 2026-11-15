export default function PageHeader({ title, subtitle, actions, extra }) {
  return (
    <div className="page-head">
      <div className="page-head-text">
        <div className="page-head-title-wrap">
          <h1>{title}</h1>
          {extra}
        </div>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}
