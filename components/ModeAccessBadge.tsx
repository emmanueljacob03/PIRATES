/** Same pill as dashboard top-right mode (ADMIN / VIEWER). */
export default function ModeAccessBadge({ label }: { label: string }) {
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-slate-700 text-slate-200 leading-tight shrink-0 inline-block">
      {label}
    </span>
  );
}
