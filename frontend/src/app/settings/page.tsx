"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";

type FamilyMember = {
  id: string;
  label: string;
};

type AppConfig = {
  allow_repeats_if_needed?: boolean;
  family_size?: number;
  max_repeat_per_week?: number;
  family_members?: FamilyMember[];
};

const ID_PATTERN = /^[a-z0-9_]+$/;

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");

export default function SettingsPage() {
  const { data, mutate } = useSWR<{ config: AppConfig }>("/api/config");
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [newMember, setNewMember] = useState("");
  const newMemberRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (data?.config) {
      setConfig(data.config);
    }
  }, [data]);

  const members = config?.family_members ?? [];

  const validationError = useMemo(() => {
    if (!config) return "";
    const labels = new Set<string>();
    for (const member of members) {
      if (!member.label.trim()) return "Every family member needs a label.";
      const labelKey = member.label.trim().toLowerCase();
      if (labels.has(labelKey)) return "Family member labels must be unique.";
      labels.add(labelKey);
      if (!member.id.trim()) return "Every family member needs a label.";
      if (!ID_PATTERN.test(member.id)) return "Generated IDs must be lowercase with numbers or underscores.";
    }
    const size = config.family_size ?? 0;
    const maxRepeat = config.max_repeat_per_week ?? 0;
    if (size <= 0) return "Family size must be at least 1.";
    if (maxRepeat <= 0) return "Max repeat per week must be at least 1.";
    return "";
  }, [config, members]);

  const addMemberError = useMemo(() => {
    const label = newMember.trim();
    if (!label) return "";
    const labelKey = label.toLowerCase();
    if (members.some((member) => member.label.trim().toLowerCase() === labelKey)) {
      return "This family member already exists.";
    }
    return "";
  }, [members, newMember]);

  const addMember = () => {
    if (!config) return;
    const label = newMember.trim();
    if (!label) {
      setError("Enter a name before adding.");
      return;
    }
    if (addMemberError) {
      setError(addMemberError);
      return;
    }
    const id = slugify(label);
    const next = [...members, { id, label }];
    setConfig({ ...config, family_members: next });
    setNewMember("");
    setError("");
    newMemberRef.current?.focus();
  };

  const removeMember = (index: number) => {
    if (!config) return;
    const next = members.filter((_, idx) => idx !== index);
    setConfig({ ...config, family_members: next });
  };

  const handleSave = async () => {
    setStatus("");
    setError("");
    if (!config) return;
    if (validationError) {
      setError(validationError);
      return;
    }
    const response = await fetch("/api/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.error ?? "Unable to save settings.");
      return;
    }
    const updated = await response.json();
    setConfig(updated.config);
    setStatus("Settings saved.");
    await mutate();
  };

  if (!config) {
    return (
      <div className="rounded-3xl border border-white/70 bg-white/80 p-6 text-sm text-slate-600 shadow-sm">
        Loading settings...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/70 bg-white/90 p-6 text-sm shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Settings</h2>
        <p className="mt-1 text-xs text-slate-500">Customize planning rules and family members.</p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs">
            <span className="font-semibold text-slate-700">Family size</span>
            <input
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              type="number"
              min={1}
              value={config.family_size ?? 4}
              onChange={(event) =>
                setConfig({ ...config, family_size: Number(event.target.value) })
              }
            />
          </label>
          <label className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs">
            <span className="font-semibold text-slate-700">Max repeats per week</span>
            <input
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              type="number"
              min={1}
              value={config.max_repeat_per_week ?? 2}
              onChange={(event) =>
                setConfig({ ...config, max_repeat_per_week: Number(event.target.value) })
              }
            />
          </label>
          <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs">
            <input
              type="checkbox"
              checked={config.allow_repeats_if_needed ?? true}
              onChange={(event) =>
                setConfig({ ...config, allow_repeats_if_needed: event.target.checked })
              }
            />
            <span className="font-semibold text-slate-700">Allow repeats if needed</span>
          </label>
        </div>
      </section>

      <section className="rounded-3xl border border-white/70 bg-white/90 p-6 text-sm shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Family members</h3>
            <p className="mt-1 text-xs text-slate-500">Used for feedback collection.</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {members.map((member, index) => (
            <div
              key={`member-${index}`}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700"
            >
              <span>{member.label}</span>
              <button
                className="text-slate-400 hover:text-slate-700"
                onClick={() => removeMember(index)}
                aria-label={`Remove ${member.label}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <input
              className={`w-full rounded-xl border px-3 py-2 pr-8 text-sm ${
                error || addMemberError ? "border-rose-300 bg-rose-50/40" : "border-slate-200"
              }`}
              placeholder="Add family member (e.g., Daughter)"
              value={newMember}
              onChange={(event) => {
                setNewMember(event.target.value);
                if (error) setError("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addMember();
                }
              }}
              ref={newMemberRef}
            />
            {newMember.trim() && (
              <span
                className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 ${
                  error || addMemberError ? "text-rose-500" : "text-emerald-500"
                }`}
                aria-hidden="true"
              >
                {error || addMemberError ? "⚠" : "✓"}
              </span>
            )}
          </div>
          <button
            className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 hover:text-slate-900"
            onClick={addMember}
          >
            Add
          </button>
        </div>

        {(error || addMemberError) && <p className="mt-2 text-xs text-rose-600">{error || addMemberError}</p>}

      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          className="rounded-full bg-emerald-700 px-4 py-2 text-xs text-white hover:bg-emerald-600"
          onClick={handleSave}
        >
          Save settings
        </button>
        {status && <span className="text-xs text-emerald-600">{status}</span>}
      </div>
    </div>
  );
}
