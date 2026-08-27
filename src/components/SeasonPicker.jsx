export default function SeasonPicker({ season, seasons, onChange }) {
  if (!seasons.length) return null;
  return (
    <select
      className="control"
      aria-label="Season"
      value={season || ''}
      onChange={(e) => onChange(e.target.value)}
    >
      {seasons.map((s) => (
        <option key={s} value={s}>{s}</option>
      ))}
    </select>
  );
}
