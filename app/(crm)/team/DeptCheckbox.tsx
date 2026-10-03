"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/app/components/Toast";

export type DeptProfileField =
  | "is_accounts"
  | "is_services";

interface DeptCheckboxProps {
  label: string;
  checked: boolean;
  memberId: string;
  memberName: string;
  field: DeptProfileField;
  onUpdate: (memberId: string, field: DeptProfileField, value: boolean) => void;
}

export function DeptCheckbox({
  label,
  checked,
  memberId,
  memberName,
  field,
  onUpdate,
}: DeptCheckboxProps) {
  const [loading, setLoading] = useState(false);
  const [value, setValue] = useState(checked);
  const supabase = createClient();
  const toast = useToast();

  useEffect(() => {
    setValue(checked);
  }, [checked]);

  const handleChange = async () => {
    const previous = value;
    const newValue = !value;
    setValue(newValue);
    setLoading(true);

    const { error } = await supabase
      .from("profiles")
      .update({ [field]: newValue })
      .eq("id", memberId);

    if (error) {
      setValue(previous);
      toast.error(`Failed to update ${memberName?.trim() || "member"}`);
      setLoading(false);
      return;
    }

    onUpdate(memberId, field, newValue);
    toast.success(
      newValue
        ? `${memberName?.trim() || "Member"} added to ${label}`
        : `${memberName?.trim() || "Member"} removed from ${label}`
    );
    setLoading(false);
  };

  return (
    <label
      className={`group flex cursor-pointer select-none items-center gap-2 ${
        loading ? "cursor-wait opacity-50" : ""
      }`}
    >
      <div className="relative">
        <input
          type="checkbox"
          checked={value}
          onChange={() => {
            void handleChange();
          }}
          disabled={loading}
          className="sr-only"
        />
        <div
          className={`flex h-4 w-4 items-center justify-center rounded border-2 transition-colors ${
            value
              ? "border-[#A87830] bg-[#A87830]"
              : "border-slate-300 group-hover:border-slate-400 dark:border-[#2E2E2E] dark:group-hover:border-slate-500"
          }`}
        >
          {value ? (
            <svg
              className="h-2.5 w-2.5 text-white"
              viewBox="0 0 10 10"
              fill="none"
              aria-hidden
            >
              <path
                d="M1.5 5l2.5 2.5 4.5-4.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : null}
        </div>
      </div>
      <span
        className={`text-xs font-medium transition-colors ${
          value
            ? "text-[#A87830]"
            : "text-slate-500 dark:text-slate-400"
        }`}
      >
        {label}
      </span>
    </label>
  );
}
