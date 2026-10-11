"use client";

import { X } from "lucide-react";
import { createContext, use, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Field, FieldDescription, FieldError, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

interface FormState {
  /** Submitted values, used as defaults so a failed submission doesn't clear the form. */
  values: Partial<Record<string, string>>;
  errors: Partial<Record<string, string[]>>;
}

const FormStateContext = createContext<FormState>({ values: {}, errors: {} });

/** The submitted or initial value of field `name`. */
export function useFormValue(name: string): string | undefined {
  return use(FormStateContext).values[name];
}

export function FormStateProvider({ children, ...state }: FormState & { children: React.ReactNode }) {
  return <FormStateContext value={state}>{children}</FormStateContext>;
}

/** A titled group of fields, set off by a rule. */
export function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <FieldSet>
      <FieldLegend
        variant="label"
        className="flex w-full items-center gap-3 text-xs tracking-wide text-muted-foreground uppercase after:h-px after:flex-1 after:bg-border"
      >
        {title}
      </FieldLegend>
      {children}
    </FieldSet>
  );
}

interface FieldProps {
  name: string;
  label: string;
  description?: string;
}

function FormField({ name, label, description, children }: FieldProps & { children: React.ReactNode }) {
  const messages = use(FormStateContext).errors[name];
  return (
    <Field data-invalid={messages ? true : undefined}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      {children}
      {description && <FieldDescription>{description}</FieldDescription>}
      <FieldError errors={messages?.map((message) => ({ message }))} />
    </Field>
  );
}

/** `clearable` adds a button that empties the input: WebKit offers no way to empty a date or time input. */
export function FormInput({
  name,
  label,
  description,
  clearable = false,
  className,
  onInput,
  ...props
}: FieldProps & { clearable?: boolean } & React.ComponentProps<"input">) {
  const { values, errors } = use(FormStateContext);
  // The input keeps what was typed after a failed submission; changing its default then would only warn.
  const [initialValue] = useState(values[name]);
  const [empty, setEmpty] = useState(!initialValue);
  const ref = useRef<HTMLInputElement>(null);
  const input = (
    <Input
      ref={ref}
      id={name}
      name={name}
      defaultValue={initialValue}
      aria-invalid={errors[name] ? true : undefined}
      // Styled date and time inputs in WebKit show the current time when empty, in full colour unless muted here.
      data-empty={empty ? true : undefined}
      onInput={(event) => {
        setEmpty(!event.currentTarget.value);
        onInput?.(event);
      }}
      className={cn("data-empty:text-muted-foreground", className)}
      {...props}
    />
  );

  return (
    <FormField name={name} label={label} description={description}>
      {clearable ? (
        <div className="flex gap-1">
          {input}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Clear ${label}`}
            disabled={empty}
            onClick={() => {
              ref.current!.value = "";
              setEmpty(true);
            }}
          >
            <X />
          </Button>
        </div>
      ) : (
        input
      )}
    </FormField>
  );
}

export function FormSelect({
  name,
  label,
  options,
  defaultValue,
  onValueChange,
}: {
  name: string;
  label: string;
  options: readonly { value: string; label: string }[];
  defaultValue: string;
  onValueChange?: (value: string) => void;
}) {
  const { values } = use(FormStateContext);
  return (
    <FormField name={name} label={label}>
      <NativeSelect
        id={name}
        name={name}
        defaultValue={values[name] ?? defaultValue}
        onChange={(event) => onValueChange?.(event.target.value)}
      >
        {options.map((option) => (
          <NativeSelectOption key={option.value} value={option.value}>
            {option.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </FormField>
  );
}

/** Toggle buttons for picking any of `options`; the picked values are submitted comma-separated. */
export function FormToggleGroup({
  name,
  label,
  options,
}: {
  name: string;
  label: string;
  options: readonly { value: string; label: string }[];
}) {
  const { values, errors } = use(FormStateContext);
  const [picked, setPicked] = useState(() => new Set(values[name]?.split(",").filter(Boolean)));
  const messages = errors[name];
  const toggle = (value: string) =>
    setPicked((current) => {
      const next = new Set(current);
      if (!next.delete(value)) next.add(value);
      return next;
    });

  return (
    <FieldSet data-invalid={messages ? true : undefined} className="gap-0">
      <FieldLegend variant="label">{label}</FieldLegend>
      <input
        type="hidden"
        name={name}
        value={options
          .filter((option) => picked.has(option.value))
          .map((option) => option.value)
          .join(",")}
      />
      <div className="flex flex-wrap gap-1">
        {options.map((option) => (
          <Button
            key={option.value}
            type="button"
            size="sm"
            variant={picked.has(option.value) ? "default" : "outline"}
            aria-pressed={picked.has(option.value)}
            onClick={() => toggle(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>
      <FieldError className="mt-2" errors={messages?.map((message) => ({ message }))} />
    </FieldSet>
  );
}
