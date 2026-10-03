export default function PipelineLoading() {
  return (
    <div className="p-6">
      <div className="mb-6 h-8 w-36 animate-pulse rounded-lg bg-gray-200 dark:bg-[#2E2E2E]" />
      <div className="mb-6 flex gap-2">
        <div className="h-9 w-36 animate-pulse rounded-lg bg-gray-200 dark:bg-[#2E2E2E]" />
        <div className="h-9 w-36 animate-pulse rounded-lg bg-gray-200 dark:bg-[#2E2E2E]" />
      </div>
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-[#2E2E2E] dark:bg-[#1C1C1C]">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex gap-4 border-b border-gray-50 px-4 py-4 dark:border-[#2E2E2E]">
            <div className="h-4 w-40 animate-pulse rounded bg-gray-200 dark:bg-[#2E2E2E]" />
            <div className="h-6 w-24 animate-pulse rounded-full bg-gray-200 dark:bg-[#2E2E2E]" />
            <div className="h-4 w-28 animate-pulse rounded bg-gray-200 dark:bg-[#2E2E2E]" />
            <div className="h-4 w-24 animate-pulse rounded bg-gray-200 dark:bg-[#2E2E2E]" />
          </div>
        ))}
      </div>
    </div>
  );
}
