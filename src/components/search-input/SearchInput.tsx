import { IconClose } from "@/components/icons/close";
import { cn } from "@/lib/utils";

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  "aria-label"?: string;
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search",
  className,
  inputClassName,
  "aria-label": ariaLabel = "Search",
}: SearchInputProps) {
  return (
    <label className={cn("relative block w-full", className)}>
      <img
        src="/icons/search.svg"
        alt=""
        className="pointer-events-none absolute left-3.5 top-1/2 size-3.5 -translate-y-1/2 opacity-50"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={cn(
          "h-9 w-full rounded-[18px] border border-[#ebebeb] bg-white pl-9 font-montserrat text-[14px] text-black outline-none placeholder:text-[#909090] focus:border-black/30",
          value ? "pr-10" : "pr-3",
          inputClassName,
        )}
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-full bg-[#e3e3e3] text-[#606060] transition-colors hover:bg-[#d6d6d6]"
        >
          <IconClose className="size-2.5" />
        </button>
      ) : null}
    </label>
  );
}
