"use client";

import { createContext, use } from "react";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

interface FormState {
  /** Submitted values, used as defaults so a failed submission doesn't clear the form. */
  values: Partial<Record<string, string>>;
  errors: Partial<Record<string, string[]>>;
}

const FormStateContext = createContext<FormState>({ values: {}, errors: {} });

export function FormStateProvider({ children, ...state }: FormState & { children: React.ReactNode }) {
  return <FormStateContext value={state}>{children}</FormStateContext>;
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

export function FormInput({ name, label, description, ...props }: FieldProps & React.ComponentProps<"input">) {
  const { values, errors } = use(FormStateContext);
  return (
    <FormField name={name} label={label} description={description}>
      <Input
        id={name}
        name={name}
        defaultValue={values[name]}
        aria-invalid={errors[name] ? true : undefined}
        {...props}
      />
    </FormField>
  );
}

export function FormSelect({
  name,
  label,
  options,
  defaultValue,
}: {
  name: string;
  label: string;
  options: readonly { value: string; label: string }[];
  defaultValue: string;
}) {
  const { values } = use(FormStateContext);
  return (
    <FormField name={name} label={label}>
      <NativeSelect id={name} name={name} defaultValue={values[name] ?? defaultValue}>
        {options.map((option) => (
          <NativeSelectOption key={option.value} value={option.value}>
            {option.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </FormField>
  );
}
