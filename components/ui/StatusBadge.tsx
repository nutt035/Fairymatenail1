import { cn } from "@/lib/utils";

export default function StatusBadge({ status }: { status: string }) {
  const styles = {
    pending: "bg-slate-100 text-slate-500",
    in_progress: "bg-primary/10 text-primary",
    finished: "bg-green-100 text-green-600",
  };
  
  const labels = {
    pending: "PENDING",
    in_progress: "IN PROGRESS",
    finished: "FINISHED"
  };

  const key = status.toLowerCase() as keyof typeof styles;

  return (
    <span className={cn("px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide", styles[key] || styles.pending)}>
      {labels[key] || status}
    </span>
  );
}