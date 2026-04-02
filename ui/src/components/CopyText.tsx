import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface CopyTextProps {
  text: string;
  /** What to display. Defaults to `text`. */
  children?: React.ReactNode;
  className?: string;
  /** Tooltip message shown after copying. Default: "Copied!" */
  copiedLabel?: string;
}

export function CopyText({ text, children, className, copiedLabel = "Copied!" }: CopyTextProps) {
  const { t } = useTranslation();
  const successLabel = copiedLabel === "Copied!" ? t("Copied!") : copiedLabel;
  const failureLabel = t("Copy failed");
  const [visible, setVisible] = useState(false);
  const [label, setLabel] = useState(successLabel);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!visible) {
      setLabel(successLabel);
    }
  }, [successLabel, visible]);

  const handleClick = useCallback(async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for non-secure contexts (e.g. HTTP on non-localhost)
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        try {
          textarea.select();
          const success = document.execCommand("copy");
          if (!success) throw new Error("execCommand copy failed");
        } finally {
          document.body.removeChild(textarea);
        }
      }
      setLabel(successLabel);
    } catch {
      setLabel(failureLabel);
    }
    clearTimeout(timerRef.current);
    setVisible(true);
    timerRef.current = setTimeout(() => setVisible(false), 1500);
  }, [failureLabel, successLabel, text]);

  return (
    <span className="relative inline-flex">
      <button
        ref={triggerRef}
        type="button"
        className={cn(
          "cursor-copy hover:text-foreground transition-colors",
          className,
        )}
        onClick={handleClick}
      >
        {children ?? text}
      </button>
      <span
        role="status"
        aria-live="polite"
        className={cn(
          "pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 rounded-md bg-foreground text-background px-2 py-1 text-xs whitespace-nowrap transition-opacity duration-300",
          visible ? "opacity-100" : "opacity-0",
        )}
      >
        {label}
      </span>
    </span>
  );
}
