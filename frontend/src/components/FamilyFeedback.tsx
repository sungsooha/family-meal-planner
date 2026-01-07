"use client";

import { ThumbsDown, ThumbsUp } from "lucide-react";
import type { FamilyFeedback } from "@/lib/feedback";

type FamilyMember = {
  id: string;
  label: string;
};

type Option = {
  value: number;
  label: string;
  Icon: typeof ThumbsUp;
};

const OPTIONS: Option[] = [
  { value: -1, label: "Thumbs down", Icon: ThumbsDown },
  { value: 1, label: "Thumbs up", Icon: ThumbsUp },
];

type Props = {
  members: FamilyMember[];
  feedback?: FamilyFeedback;
  onChange?: (memberId: string, value: number) => void;
  compact?: boolean;
};

export default function FamilyFeedback({ members, feedback, onChange, compact = false }: Props) {
  if (!members.length) {
    return <p className="text-xs text-slate-500">Add family members in Settings to collect feedback.</p>;
  }

  return (
    <div className="space-y-3">
      {members.map((member) => {
        const value = feedback?.[member.id] ?? 0;
        return (
          <div key={member.id} className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-700">{member.label}</span>
            <div className="flex items-center gap-1">
              {OPTIONS.map(({ value: optionValue, label, Icon }) => {
                const isActive = value === optionValue;
                return (
                  <button
                    key={`${member.id}-${optionValue}`}
                    className={`flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] transition ${
                      isActive
                        ? "border-rose-200 bg-rose-50 text-rose-700"
                        : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                    } ${compact ? "text-[10px]" : ""}`}
                    onClick={() => onChange?.(member.id, isActive ? 0 : optionValue)}
                    aria-label={`${member.label}: ${label}`}
                    type="button"
                  >
                    <Icon className="h-3 w-3" />
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
