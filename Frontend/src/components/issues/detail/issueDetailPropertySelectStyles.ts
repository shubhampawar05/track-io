/** Generic copy when a property select has no items (trigger shows this; root is disabled so the menu does not open). */
export const SELECT_NO_OPTIONS_MESSAGE = "No options available";

/** Shared Select styling for issue detail property rows (header quick fields + side panel). */
export const propertyRowClass =
  "flex h-9 w-full items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--hover)] px-2.5 text-[13px] text-[var(--text)] transition-colors hover:bg-muted focus-visible:border-[var(--border)] focus-visible:ring-0 dark:border-[rgba(255,255,255,0.08)] dark:bg-[rgba(255,255,255,0.04)] dark:text-white dark:hover:border-[rgba(255,255,255,0.15)] dark:hover:bg-[rgba(255,255,255,0.06)] dark:focus-visible:border-[rgba(255,255,255,0.15)]";

export const propertySelectContentClass =
  "bg-[var(--card)] border border-[var(--border)] text-[var(--text)] shadow-lg rounded-md p-1 max-h-[min(280px,50vh)] ring-0 dark:bg-[#1e1e2e] dark:border-[rgba(255,255,255,0.08)] dark:text-white";

export const propertySelectItemClass =
  "rounded-sm py-2 pl-2 pr-8 text-[13px] text-[var(--text)] focus:bg-[var(--hover)] focus:text-[var(--text)] data-highlighted:bg-[var(--hover)] data-highlighted:text-[var(--text)] aria-selected:bg-[color-mix(in_srgb,var(--text)_8%,var(--card))] aria-selected:text-[var(--text)] dark:text-white dark:focus:bg-[rgba(255,255,255,0.06)] dark:focus:text-white dark:data-highlighted:bg-[rgba(255,255,255,0.06)] dark:data-highlighted:text-white dark:aria-selected:bg-[rgba(255,255,255,0.1)] dark:aria-selected:text-white";

/** Shell around nested controls (e.g. comment composer): primary border + inset glow while focused within. Inset avoids clipping under scroll parents with overflow-x-hidden. */
export const issueDetailFocusWithinFieldShell =
  "transition-[border-color,box-shadow] duration-200 focus-within:border-[var(--primary)] focus-within:ring-2 focus-within:ring-inset focus-within:ring-[color-mix(in_srgb,var(--primary)_22%,transparent)]";

/** Bordered text field: same primary border + inset glow on focus (issue key, etc.). */
export const issueDetailBorderedInputFocusClass =
  "transition-[border-color,box-shadow] duration-200 outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-inset focus:ring-[color-mix(in_srgb,var(--primary)_22%,transparent)] disabled:focus:border-[var(--border)] disabled:focus:ring-0";
