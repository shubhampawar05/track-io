import type { HTMLAttributes } from "react";

export function Skeleton({
  className = "",
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={`animate-pulse rounded-md bg-(--hover) ${className}`.trim()}
      {...rest}
    />
  );
}
