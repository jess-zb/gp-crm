export function AssigneeIdentity({
  name,
  directLine,
  empty = "—",
}: {
  name: string | null | undefined;
  directLine?: string | null;
  empty?: string;
}) {
  const label = name?.trim() || "";
  const line = directLine?.trim() || "";
  if (!label && !line) {
    return <span className="block truncate">{empty}</span>;
  }
  return (
    <span className="block min-w-0">
      <span className="block truncate">{label || empty}</span>
      {line ? (
        <span className="block truncate text-xs font-normal text-slate-500 dark:text-slate-400">
          {line}
        </span>
      ) : null}
    </span>
  );
}
