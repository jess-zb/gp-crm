export default function ClientProfileLoading() {
  return (
    <div className="flex gap-6 p-6">
      {/* Main content */}
      <div className="flex-1">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <div className="h-8 w-48 animate-pulse rounded-lg bg-gray-200 dark:bg-[#1a3550]" />
          <div className="h-6 w-24 animate-pulse rounded-full bg-gray-200 dark:bg-[#1a3550]" />
        </div>

        {/* Stage buttons */}
        <div className="mb-6 flex gap-3">
          <div className="h-9 w-28 animate-pulse rounded-lg bg-gray-200 dark:bg-[#1a3550]" />
          <div className="h-9 w-8 animate-pulse rounded-lg bg-gray-200 dark:bg-[#1a3550]" />
          <div className="h-9 w-32 animate-pulse rounded-lg bg-gray-200 dark:bg-[#1a3550]" />
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 border-b border-gray-200 dark:border-[#1a3550]">
          {["Account", "Documents", "Activity", "Drips"].map((tab) => (
            <div
              key={tab}
              className="h-10 w-20 animate-pulse rounded-t-lg bg-gray-200 dark:bg-[#1a3550]"
            />
          ))}
        </div>

        {/* Content area */}
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex gap-4">
              <div className="h-4 w-32 animate-pulse rounded bg-gray-200 dark:bg-[#1a3550]" />
              <div className="h-4 flex-1 animate-pulse rounded bg-gray-100 dark:bg-[#223a24]" />
            </div>
          ))}
        </div>
      </div>

      {/* Right sidebar */}
      <div className="w-80 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-gray-200 bg-white p-4 dark:border-[#1a3550] dark:bg-[#0d2035]"
          >
            <div className="mb-3 h-5 w-24 animate-pulse rounded bg-gray-200 dark:bg-[#1a3550]" />
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="h-4 animate-pulse rounded bg-gray-100 dark:bg-[#223a24]" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
