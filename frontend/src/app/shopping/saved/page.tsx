"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { X, Pencil, RefreshCw, Lock, Unlock, Trash2, Printer } from "lucide-react";
import { useToast } from "@/components/ToastProvider";
import type {
  BuyList,
  BuyListItem,
  BuyListUpdateRequest,
  BuyListUpdateResponse,
  BuyListsResponse,
} from "@/lib/types";

export default function SavedBuyListsPage() {
  const [lists, setLists] = useState<BuyList[]>([]);
  const [editing, setEditing] = useState<BuyList | null>(null);
  const [draftItems, setDraftItems] = useState<BuyListItem[]>([]);
  const { showToast } = useToast();

  const { data: listsData, mutate: mutateLists } = useSWR<BuyListsResponse>("/api/buy-lists");

  useEffect(() => {
    if (listsData?.lists) {
      setLists(listsData.lists);
    }
  }, [listsData]);

  const handleSync = async (list: BuyList) => {
    const response = await fetch(`/api/buy-lists/${list.id}/sync`, { method: "POST" });
    const data = (await response.json().catch(() => ({}))) as BuyListUpdateResponse;
    if (!response.ok) {
      showToast("Unable to sync list.");
      return;
    }
    showToast("List synced from current week.");
    await mutateLists();
  };

  const handleToggleLock = async (list: BuyList) => {
    const updated = { ...list, status: list.status === "open" ? "locked" : "open" };
    const response = await fetch(`/api/buy-lists/${list.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    });
    const data = (await response.json().catch(() => ({}))) as BuyListUpdateResponse;
    if (!response.ok) {
      showToast("Unable to update list.");
      return;
    }
    await mutateLists();
  };

  const handleDelete = async (list: BuyList) => {
    const response = await fetch(`/api/buy-lists/${list.id}`, { method: "DELETE" });
    const data = (await response.json().catch(() => ({}))) as BuyListUpdateResponse;
    if (!response.ok) {
      showToast("Unable to delete list.");
      return;
    }
    await mutateLists();
  };

  const openEdit = (list: BuyList) => {
    setEditing(list);
    setDraftItems(list.items.map((item) => ({ ...item })));
  };

  const handlePrint = (list: BuyList) => {
    const title = "Shopping List";
    const html = `
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: "Helvetica Neue", Arial, sans-serif; padding: 24px; }
            h1 { font-size: 20px; margin-bottom: 16px; }
            ul { list-style: none; padding: 0; }
            li { margin-bottom: 8px; font-size: 14px; display: flex; align-items: center; gap: 8px; }
            input { width: 16px; height: 16px; }
          </style>
        </head>
        <body>
          <h1>${title}</h1>
          <ul>
            ${list.items
              .map(
                (item) =>
                  `<li><input type="checkbox" /> ${item.name} — ${item.quantity} ${item.unit}</li>`,
              )
              .join("")}
          </ul>
        </body>
      </html>
    `;
    const win = window.open("", "_blank", "width=600,height=800");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  };

  const saveEdit = async () => {
    if (!editing) return;
    const updated = { ...editing, items: draftItems };
    const response = await fetch(`/api/buy-lists/${editing.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    });
    const data = (await response.json().catch(() => ({}))) as BuyListUpdateResponse;
    if (!response.ok) {
      showToast("Unable to save list.");
      return;
    }
    setEditing(null);
    await mutateLists();
  };

  return (
    <div className="space-y-6">
      <section className="sticky top-[calc(var(--header-height)+0.5rem)] z-20 scroll-mt-[calc(var(--header-height)+2rem)] rounded-3xl border border-white/70 bg-white/95 p-4 text-xs shadow-sm backdrop-blur">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Saved buy lists</p>
          <h2 className="text-lg font-semibold text-slate-900">Past shopping sessions</h2>
        </div>
      </section>

      <section className="grid gap-4">
        {lists.map((list) => (
          <div
            key={list.id}
            className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-sm transition hover:shadow-lg hover:ring-2 hover:ring-emerald-200/70"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-dashed border-slate-200 pb-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  {list.week_start} → {list.week_end}
                </p>
                <p className="text-sm font-semibold text-slate-900">
                  {list.items.length} items · {list.lang === "original" ? "Korean" : "English"}
                </p>
                <p className="text-xs text-slate-500">Saved at {new Date(list.saved_at).toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-500"
                  onClick={() => handlePrint(list)}
                >
                  <Printer className="mr-1 inline h-3 w-3" /> Print
                </button>
                {list.status === "open" && (
                  <button
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-500"
                    onClick={() => handleSync(list)}
                  >
                    <RefreshCw className="mr-1 inline h-3 w-3" /> Sync
                  </button>
                )}
                <button
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-500"
                  onClick={() => handleToggleLock(list)}
                >
                  {list.status === "open" ? (
                    <Lock className="mr-1 inline h-3 w-3" />
                  ) : (
                    <Unlock className="mr-1 inline h-3 w-3" />
                  )}
                  {list.status === "open" ? "Lock" : "Unlock"}
                </button>
                <button
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-500"
                  onClick={() => openEdit(list)}
                >
                  <Pencil className="mr-1 inline h-3 w-3" /> Edit
                </button>
                <button
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-rose-500"
                  onClick={() => handleDelete(list)}
                >
                  <Trash2 className="mr-1 inline h-3 w-3" /> Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </section>

      {editing && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-3xl rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Edit buy list</h3>
              <button onClick={() => setEditing(null)}>
                <X className="h-4 w-4 text-slate-400" />
              </button>
            </div>
            <div className="mt-4 grid gap-2 max-h-[60vh] overflow-y-auto">
              {draftItems.map((item, index) => (
                <div key={`${item.name}-${index}`} className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                  <span className="flex-1 text-xs text-slate-700">{item.name}</span>
                  <input
                    className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-xs"
                    value={String(item.quantity ?? "")}
                    onChange={(event) => {
                      const next = [...draftItems];
                      next[index] = { ...next[index], quantity: event.target.value };
                      setDraftItems(next);
                    }}
                  />
                  <span className="text-xs text-slate-400">{item.unit}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="rounded-full border border-slate-200 px-4 py-2 text-xs text-slate-500"
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
              <button
                className="rounded-full bg-emerald-700 px-4 py-2 text-xs text-white hover:bg-emerald-600"
                onClick={saveEdit}
              >
                Save changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
