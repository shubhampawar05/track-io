"use client";

import type { CSSProperties } from "react";
import dynamic from "next/dynamic";
import { EmojiStyle, Theme } from "emoji-picker-react";

/**
 * Applied on the picker root via `style` so values override the library’s
 * class-based defaults (parent-level vars do not win on `.EmojiPickerReact`).
 */
const EPR_COMPACT: CSSProperties = {
  "--epr-emoji-size": "20px",
  "--epr-emoji-padding": "3px",
  "--epr-horizontal-padding": "6px",
  "--epr-header-padding": "6px 6px",
  "--epr-search-bar-inner-padding": "6px",
  "--epr-search-input-height": "34px",
  "--epr-search-input-padding": "7px 26px",
  "--epr-search-input-border-radius": "6px",
  "--epr-category-navigation-button-size": "20px",
  "--epr-category-padding": "2px 4px",
  "--epr-category-label-height": "20px",
  "--epr-category-label-padding": "2px 4px",
  "--epr-picker-border-radius": "6px",
} as CSSProperties;

const EmojiPicker = dynamic(() => import("emoji-picker-react"), {
  ssr: false,
  loading: () => (
    <div
      className="comment-emoji-picker-host flex h-[244px] w-full min-w-0 items-center justify-center rounded-md bg-[var(--card)] text-xs text-linear-text-muted"
      aria-busy
      aria-label="Loading emoji picker"
    >
      Loading emoji picker…
    </div>
  ),
});

export function CommentEmojiPicker({
  onPick,
}: {
  onPick: (emoji: string) => void;
}) {
  return (
    <div className="comment-emoji-picker-host w-full min-w-0 [&_aside.EmojiPickerReact]:!max-w-full [&_aside.EmojiPickerReact]:!border-0 [&_aside.EmojiPickerReact]:!shadow-none">
      <EmojiPicker
        width="100%"
        height={244}
        theme={Theme.DARK}
        emojiStyle={EmojiStyle.NATIVE}
        lazyLoadEmojis
        skinTonesDisabled
        autoFocusSearch={false}
        previewConfig={{ showPreview: false }}
        searchPlaceHolder="Search emojis"
        className="!border-0 !shadow-none placeholder:text-[14px]"
        style={EPR_COMPACT}
        onEmojiClick={(data) => {
          onPick(data.emoji);
        }}
      />
    </div>
  );
}
