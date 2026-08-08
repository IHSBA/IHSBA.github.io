import { Link } from 'react-router-dom';

export default function Empty({ message, cta }) {
  return (
    <div className="empty card card-pad">
      <p className="muted">{message}</p>
      {cta && (
        <Link className="btn btn-primary btn-sm" to={cta.to}>
          {cta.label}
        </Link>
      )}
    </div>
  );
}
