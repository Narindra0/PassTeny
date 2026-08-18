"use client";

/**
 * Champ de recherche de la page /search — soumet vers ?q= à chaque envoi.
 */
import { useRouter } from "next/navigation";
import { useRef } from "react";

interface SearchInputProps {
  initialQuery?: string;
}

export default function SearchInput({ initialQuery = "" }: SearchInputProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  function submit() {
    const q = inputRef.current?.value.trim() ?? "";
    if (q.length < 2) return;
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex items-center gap-3 rounded-2xl border border-line-strong bg-card px-5 shadow-card transition-colors focus-within:border-ink"
    >
      <i className="fa-solid fa-magnifying-glass shrink-0 text-sm text-ink-faint" aria-hidden="true" />
      <input
        ref={inputRef}
        type="text"
        defaultValue={initialQuery}
        placeholder="Rechercher un titre, un artiste, une parole…"
        aria-label="Rechercher dans le catalogue"
        autoComplete="off"
        spellCheck={false}
        className="h-14 min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-faint"
      />
      <button
        type="submit"
        className="shrink-0 rounded-lg bg-red px-4 py-2 text-sm font-bold text-paper transition-colors hover:bg-red-dark"
      >
        Rechercher
      </button>
    </form>
  );
}
