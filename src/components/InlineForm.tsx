"use client";

import { useState } from "react";

export type InlineField = { key: string; label: string; value: string; rows?: number };

/**
 * A small edit form for a handful of text fields. onSave returns an error
 * message (shown inline, form stays open) or null on success (caller closes it).
 */
export function InlineForm({
  fields,
  onSave,
  onCancel,
}: {
  fields: InlineField[];
  onSave: (values: Record<string, string>) => Promise<string | null>;
  onCancel: () => void;
}) {
  const [values, setValues] = useState(() => Object.fromEntries(fields.map((f) => [f.key, f.value])));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const err = await onSave(values);
    if (err) {
      setError(err);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-md border border-neutral-200 bg-neutral-50 p-3">
      {fields.map((f) => (
        <label key={f.key} className="block">
          <span className="mb-1 block text-xs font-medium text-neutral-600">{f.label}</span>
          {f.rows && f.rows > 1 ? (
            <textarea
              value={values[f.key]}
              rows={f.rows}
              onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
            />
          ) : (
            <input
              value={values[f.key]}
              onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
            />
          )}
        </label>
      ))}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

/** Small text-style action used next to edit/delete affordances. */
export function LinkButton({
  onClick,
  children,
  danger,
  disabled,
}: {
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`text-xs underline disabled:opacity-50 ${danger ? "text-red-600" : "text-neutral-500"}`}
    >
      {children}
    </button>
  );
}
