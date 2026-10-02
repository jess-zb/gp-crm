import { getStageConfig } from "@/lib/constants/stages";

interface StagePillProps {
  stage: string;
  className?: string;
}

export function StagePill({ stage, className = "" }: StagePillProps) {
  const config = getStageConfig(stage);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${config.color} ${config.border} ${className}`.trim()}
    >
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${config.dot}`}
        aria-hidden
      />
      {config.label}
    </span>
  );
}
