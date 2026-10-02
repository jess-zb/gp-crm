export default function ClientsLoading() {
  return (
    <div className="p-6">
      {/* Header skeleton */}
      <div className="mb-6 flex items-center justify-between">
        <div className="h-8 w-32 animate-pulse rounded-lg bg-gray-200 dark:bg-[#1a3550]" />
        <div className="flex gap-3">
          <div className="h-9 w-28 animate-pulse rounded-lg bg-gray-200 dark:bg-[#1a3550]" />
          <div className="h-9 w-36 animate-pulse rounded-lg bg-gray-200 dark:bg-[#1a3550]" />
        </div>
      </div>

      {/* Tab skeleton */}
      <div className="mb-4 flex gap-2">
        {[80, 60, 70, 65].map((w, i) => (
          <div
            key={i}
            className="h-9 animate-pulse rounded-lg bg-gray-200 dark:bg-[#1a3550]"
            style={{ width: w }}
          />
        ))}
      </div>

      {/* Search skeleton */}
      <div className="mb-4 h-10 w-full animate-pulse rounded-lg bg-gray-200 dark:bg-[#1a3550]" />

      {/* Table skeleton */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-[#1a3550] dark:bg-[#0d2035]">
        {/* Table header */}
        <div className="flex gap-4 border-b border-gray-100 bg-gray-50 px-4 py-3 dark:border-[#1a3550] dark:bg-[#102840]">
          {[200, 100, 120, 150, 100].map((w, i) => (
            <div
              key={i}
              className="h-4 animate-pulse rounded bg-gray-200 dark:bg-[#1a3550]"
              style={{ width: w }}
            />
          ))}
        </div>

        {/* Table rows */}
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-gray-50 px-4 py-4 dark:border-[#1a3550]"
          >
            <div className="h-4 w-4 animate-pulse rounded bg-gray-200 dark:bg-[#1a3550]" />
            <div className="flex flex-1 flex-col gap-1.5">
              <div className="h-4 w-40 animate-pulse rounded bg-gray-200 dark:bg-[#1a3550]" />
              <div className="h-3 w-32 animate-pulse rounded bg-gray-100 dark:bg-[#223a24]" />
            </div>
            <div className="h-6 w-24 animate-pulse rounded-full bg-gray-200 dark:bg-[#1a3550]" />
            <div className="h-4 w-28 animate-pulse rounded bg-gray-200 dark:bg-[#1a3550]" />
            <div className="h-4 w-24 animate-pulse rounded bg-gray-200 dark:bg-[#1a3550]" />
            <div className="h-4 w-20 animate-pulse rounded bg-gray-200 dark:bg-[#1a3550]" />
          </div>
        ))}
      </div>

      {/* Pagination skeleton */}
      <div className="mt-4 flex items-center justify-between">
        <div className="h-4 w-40 animate-pulse rounded bg-gray-200 dark:bg-[#1a3550]" />
        <div className="flex gap-2">
          <div className="h-9 w-24 animate-pulse rounded-lg bg-gray-200 dark:bg-[#1a3550]" />
          <div className="h-9 w-24 animate-pulse rounded-lg bg-gray-200 dark:bg-[#1a3550]" />
        </div>
      </div>
    </div>
  );
}
