import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-[#E5E7EB]", className)}
      aria-hidden="true"
      {...props}
    />
  );
}

export { Skeleton };
