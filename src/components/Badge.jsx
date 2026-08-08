const LABEL = { W: 'W', L: 'L', T: 'T' };

export default function ResultBadge({ result }) {
  if (!result || !LABEL[result]) return <span className="badge badge-na">TBD</span>;
  return <span className={`badge badge-${result.toLowerCase()}`}>{LABEL[result]}</span>;
}
