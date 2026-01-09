"use client";

import { Search } from "lucide-react";

type Props = {
  onClick: () => void;
  label?: string;
  className?: string;
};

export default function SearchAddActionButton({
  onClick,
  label = "Search & add",
  className = "flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:text-slate-900",
}: Props) {
  return (
    <button
      className={className}
      onClick={onClick}
      type="button"
    >
      <Search className="h-4 w-4" />
      {label}
    </button>
  );
}
