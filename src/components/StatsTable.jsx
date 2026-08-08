import { fmtRate } from '../stats/stats';
import { fmtWar, fmtRate3, fmtWRC } from '../stats/advancedStats';

// Column set/order matches the KBO/Statiz-style reference table.
const COLUMNS = [
  { key: 'Div', label: 'Div.', group: null, type: 'text' },
  { key: 'Year', label: 'Year', group: null, type: 'text' },
  { key: 'Team', label: 'Team', group: null, type: 'text' },
  { key: 'Age', label: 'Age', group: null, type: 'text' },
  { key: 'Pos', label: 'Pos.', group: null, type: 'text' },
  { key: 'G', label: 'G', group: null, type: 'int' },
  { key: 'oWAR', label: 'oWAR', group: null, type: 'war' },
  { key: 'dWAR', label: 'dWAR', group: null, type: 'war' },
  { key: 'PA', label: 'PA', group: null, type: 'int' },
  { key: 'ePA', label: 'ePA', group: null, type: 'int' },
  { key: 'AB', label: 'AB', group: null, type: 'int' },
  { key: 'R', label: 'R', group: null, type: 'int' },
  { key: 'H', label: 'H', group: null, type: 'int' },
  { key: '2B', label: '2B', group: null, type: 'int' },
  { key: '3B', label: '3B', group: null, type: 'int' },
  { key: 'HR', label: 'HR', group: null, type: 'int' },
  { key: 'TB', label: 'TB', group: null, type: 'int' },
  { key: 'RBI', label: 'RBI', group: null, type: 'int' },
  { key: 'SB', label: 'SB', group: null, type: 'int' },
  { key: 'CS', label: 'CS', group: null, type: 'int' },
  { key: 'BB', label: 'BB', group: null, type: 'int' },
  { key: 'HBP', label: 'HP', group: null, type: 'int' },
  { key: 'IB', label: 'IB', group: null, type: 'int' },
  { key: 'SO', label: 'SO', group: null, type: 'int' },
  { key: 'GDP', label: 'GDP', group: null, type: 'int' },
  { key: 'SH', label: 'SH', group: null, type: 'int' },
  { key: 'SF', label: 'SF', group: null, type: 'int' },
  { key: 'AVG', label: 'AVG', group: 'ratio', type: 'rate' },
  { key: 'OBP', label: 'OBP', group: 'ratio', type: 'rate' },
  { key: 'SLG', label: 'SLG', group: 'ratio', type: 'rate' },
  { key: 'OPS', label: 'OPS', group: 'ratio', type: 'rate' },
  { key: 'RePA', label: 'R/ePA', group: null, type: 'repa' },
  { key: 'wRCPlus', label: 'wRC+', group: null, type: 'wrc' },
  { key: 'WAR', label: 'WAR', group: null, type: 'war' },
];
const GROUP_LABELS = { ratio: '비율' };

function fmtCell(type, val) {
  switch (type) {
    case 'text':
      return val == null || val === '' ? '-' : String(val);
    case 'int':
      return String(val != null ? val : 0);
    case 'rate':
      return fmtRate(val);
    case 'war':
      return fmtWar(val);
    case 'repa':
      return fmtRate3(val);
    case 'wrc':
      return fmtWRC(val);
    default:
      return val != null ? String(val) : '-';
  }
}

function buildHeaderRows() {
  const row1 = [];
  const row2 = [];
  let i = 0;
  while (i < COLUMNS.length) {
    const col = COLUMNS[i];
    if (!col.group) {
      row1.push(
        <th key={col.key} rowSpan={2} className={col.key === 'Div' ? 'div-cell' : ''}>
          {col.label}
        </th>
      );
      i++;
      continue;
    }
    let j = i;
    while (j < COLUMNS.length && COLUMNS[j].group === col.group) j++;
    row1.push(
      <th key={col.group} colSpan={j - i} className="group-label">
        {GROUP_LABELS[col.group] || ''}
      </th>
    );
    for (let k = i; k < j; k++) row2.push(<th key={COLUMNS[k].key}>{COLUMNS[k].label}</th>);
    i = j;
  }
  return { row1, row2 };
}

// `rows` are stats.js majorRecordRows() entries merged with
// advancedStats.js computeAdvanced() output. Highlights the Career row.
export default function StatsTable({ rows }) {
  const { row1, row2 } = buildHeaderRows();
  return (
    <table className="stats major">
      <thead>
        <tr className="group-row">{row1}</tr>
        <tr>{row2}</tr>
      </thead>
      <tbody>
        {rows.map((row, idx) => (
          <tr key={idx} className={row.Div === 'Career' ? 'career-row' : ''}>
            {COLUMNS.map((col) => (
              <td
                key={col.key}
                className={`${col.type === 'text' ? '' : 'num'}${col.key === 'Div' ? ' div-cell' : ''}`}
              >
                {fmtCell(col.type, row[col.key])}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
