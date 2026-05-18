/** e.g. "just now", "1 hr ago", "2 days ago" */
export function formatTimeAgo(dateStr?: string | null): string | null {
  if (!dateStr) return null;

  const then = new Date(dateStr).getTime();
  if (Number.isNaN(then)) return null;

  const diff = Date.now() - then;
  if (diff < 0) return null;

  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return mins === 1 ? "1 min ago" : `${mins} mins ago`;

  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs === 1 ? "1 hr ago" : `${hrs} hrs ago`;

  const days = Math.floor(hrs / 24);
  if (days < 7) return days === 1 ? "1 day ago" : `${days} days ago`;

  const weeks = Math.floor(days / 7);
  if (weeks < 5) return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return months === 1 ? "1 month ago" : `${months} months ago`;

  const years = Math.floor(days / 365);
  return years === 1 ? "1 year ago" : `${years} years ago`;
}
