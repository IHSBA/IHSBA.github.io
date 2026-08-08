import { initials } from '../lib/format';

const SIZE_CLASS = { xs: 'avatar-xs', sm: 'avatar-sm', md: '', lg: 'avatar-lg' };

export default function Avatar({ player, size = 'md', className = '' }) {
  const cls = `avatar ${SIZE_CLASS[size] || ''} ${className}`.trim();
  const name = player?.name_en || player?.name;
  if (player?.profile_photo_url) {
    return (
      <div className={cls}>
        <img src={player.profile_photo_url} alt={name || ''} loading="lazy" />
      </div>
    );
  }
  return <div className={cls}>{initials(name)}</div>;
}
