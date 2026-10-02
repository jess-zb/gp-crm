export default function FedexBatchesLoading() {
  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 h-8 w-48 animate-pulse rounded-lg bg-gray-200 dark:bg-[#1a3550]" />

      {/* Tabs */}
      <div className="mb-6 flex gap-1 border-b border-gray-200 dark:border-[#1a3550]">
        {[120, 180, 160, 100].map((w, i) => (
          <div
            key={i}
            className="h-10 animate-pulse rounded-t-lg bg-gray-200 dark:bg-[#1a3550]"
            style={{ width: w }}
          />
        ))}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-[#1a3550] dark:bg-[#0d2035]">
        <div className="flex gap-4 border-b bg-gray-50 px-4 py-3 dark:border-[#1a3550] dark:bg-[#102840]">
          {[200, 120, 150, 100, 120].map((w, i) => (
            <div
              key={i}
              className="h-4 animate-pulse rounded bg-gray-200 dark:bg-[#1a3550]"
              style={{ width: w }}
            />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex gap-4 border-b border-gray-50 px-4 py-4 dark:border-[#1a3550]">
            <div className="h-4 w-40 animate-pulse rounded bg-gray-200 dark:bg-[#1a3550]" />
            <div className="h-4 w-28 animate-pulse rounded bg-gray-200 dark:bg-[#1a3550]" />
            <div className="h-6 w-36 animate-pulse rounded bg-gray-200 dark:bg-[#1a3550]" />
            <div className="h-6 w-20 animate-pulse rounded-full bg-gray-200 dark:bg-[#1a3550]" />
          </div>
        ))}
      </div>
    </div>
  );
}
