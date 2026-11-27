"use client";

export default function IssuesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto custom-scrollbar">{children}</div>
  );
}
