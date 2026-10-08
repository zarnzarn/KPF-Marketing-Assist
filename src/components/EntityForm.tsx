"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { Card } from "@/components/ui";
import { initialValues, validateFields, type FieldConfig, type FormErrors, type FormValues } from "@/lib/forms";

const inputCls = "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm";

/** A generic, accessible form built from field definitions (see src/lib/forms.ts). */
export function EntityForm({
  title,
  fields,
  defaults,
  submitLabel = "Save",
  extraValidate,
  onSubmit,
  onCancel,
}: {
  title: string;
  fields: FieldConfig[];
  defaults?: FormValues;
  submitLabel?: string;
  extraValidate?: (values: FormValues) => FormErrors;
  onSubmit: (values: FormValues) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<FormValues>(() => initialValues(fields, defaults));
  const [errors, setErrors] = useState<FormErrors>({});
  const uid = useId();
  const firstRef = useRef<HTMLInputElement>(null);
  const id = (name: string) => `${uid}-${name}`;

  const openerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    // Remember the button that opened the form (once, even when React runs this twice in development)
    // and give focus back to it when the form closes.
    const active = document.activeElement;
    if (!openerRef.current && active instanceof HTMLElement && active !== document.body) openerRef.current = active;
    firstRef.current?.focus();
    return () => {
      // Only when focus was lost with the form; if another button (for example one opening a different form) has focus, leave it there.
      const opener = openerRef.current;
      const lost = !document.activeElement || document.activeElement === document.body;
      if (opener?.isConnected && lost) opener.focus();
    };
  }, []);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const found = { ...validateFields(fields, values), ...(extraValidate?.(values) ?? {}) };
    // A number box the browser could not read reports "" as its value; say so instead of treating it as blank.
    for (const f of fields.filter((x) => x.type === "number")) {
      const el = e.currentTarget.elements.namedItem(f.name);
      if (el instanceof HTMLInputElement && el.validity.badInput) found[f.name] = `${f.label} must be a number.`;
    }
    setErrors(found);
    const firstInvalid = fields.find((f) => found[f.name]);
    if (firstInvalid) {
      document.getElementById(id(firstInvalid.name))?.focus(); // the error is read out with the field
      return;
    }
    onSubmit(values);
  }

  return (
    <Card title={title}>
      <form onSubmit={submit} noValidate className="grid gap-4 md:grid-cols-2">
        {fields.map((f, i) => {
          const error = errors[f.name];
          const describedBy = [error ? `${id(f.name)}-err` : "", f.hint ? `${id(f.name)}-hint` : ""].filter(Boolean).join(" ") || undefined;
          const common = {
            id: id(f.name),
            name: f.name,
            value: values[f.name] ?? "",
            "aria-invalid": !!error,
            "aria-describedby": describedBy,
            className: inputCls,
            onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setValues((v) => ({ ...v, [f.name]: e.target.value })),
          };
          return (
            <div key={f.name} className={f.type === "textarea" ? "md:col-span-2" : undefined}>
              <label htmlFor={id(f.name)} className="mb-1 block text-sm font-medium">
                {f.label}
                {f.required && <span className="text-clay"> *</span>}
                {f.required && <span className="sr-only"> (required)</span>}
              </label>
              {f.type === "textarea" ? (
                <textarea {...common} rows={3} />
              ) : f.type === "select" ? (
                <select {...common}>
                  {!f.required && <option value="">None</option>}
                  {f.options?.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              ) : (
                <input {...common} ref={i === 0 ? firstRef : undefined} type={f.type === "number" ? "number" : f.type} min={f.type === "number" ? 0 : undefined} />
              )}
              {f.hint && (
                <p id={`${id(f.name)}-hint`} className="mt-1 text-xs text-muted">
                  {f.hint}
                </p>
              )}
              {error && (
                <p id={`${id(f.name)}-err`} className="mt-1 text-sm font-medium text-clay">
                  {error}
                </p>
              )}
            </div>
          );
        })}
        <div className="flex gap-3 md:col-span-2">
          <button type="submit" className="rounded-xl bg-forest px-5 py-2.5 font-semibold text-white hover:bg-sage">
            {submitLabel}
          </button>
          <button type="button" onClick={onCancel} className="rounded-xl border border-line bg-white px-5 py-2.5 font-semibold hover:border-yolk">
            Cancel
          </button>
        </div>
      </form>
    </Card>
  );
}

export function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-2 rounded-xl bg-forest px-4 py-2.5 font-semibold text-white hover:bg-sage">
      <Plus className="h-4 w-4" aria-hidden="true" /> {label}
    </button>
  );
}

export function DeleteButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-semibold text-clay hover:border-clay">
      Delete<span className="sr-only"> {label}</span>
    </button>
  );
}

/** Polite status message for screen readers ("Meeting added." etc.). */
export function StatusMessage({ text }: { text: string }) {
  return (
    <p role="status" className="text-sm font-medium text-sage">
      {text}
    </p>
  );
}
