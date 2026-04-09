interface SkeletonProps {
  height?: number;
}

export function Skeleton({ height = 14 }: SkeletonProps) {
  return <div className="dl-skeleton" style={{ height }} aria-hidden />;
}
