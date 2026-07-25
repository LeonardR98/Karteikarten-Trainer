export function TagBadgeList({ tags }) {
  if (!tags?.length) return null;

  const visible = tags.slice(0, 2);
  const overflow = tags.length - visible.length;

  return (
    <span className="tag-badge-list">
      {visible.map((tag) => (
        <span key={tag} className="tag-badge">
          {tag}
        </span>
      ))}
      {overflow > 0 && <span className="tag-badge tag-badge-overflow">+{overflow}</span>}
    </span>
  );
}
