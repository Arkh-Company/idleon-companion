// Where this goes (spec 008 US8, FR-027): a part that 2 or more catalog numbers use shows a badge with how many. The
// badge is only the number, hidden from the reader: the row's name says "feeds N numbers". A tap on it opens the row's
// list of those numbers, a treeview row like the others, so the keyboard reaches it with the arrows; the list is asked
// of the main once per part and count.
import { useRef, useState } from "react";

/** The words of a part's count, in its row's name. */
export const feedsText = (count: number) => `feeds ${String(count)} numbers`;

/** While the main finds the numbers of a part. */
export const FEEDS_LOADING = "finding the numbers…";

export function FeedsBadge({
  count,
  onTap,
}: {
  count: number;
  /** The row opens with its list, and the focus goes to the list's row. */
  onTap: () => void;
}) {
  return (
    <span
      className="feeds"
      aria-hidden="true"
      onClick={(e) => {
        e.stopPropagation();
        onTap();
      }}
    >
      {count}
    </span>
  );
}

/**
 * The numbers of each piece, asked of the main when its list opens: once, and again once its count changed (the index
 * fills in the background).
 */
export function useFeedsLists(): {
  of: (pieceKey: string) => readonly string[] | undefined;
  load: (pieceKey: string, count: number) => void;
} {
  const [lists, setLists] = useState<ReadonlyMap<string, readonly string[]>>(
    () => new Map(),
  );
  /** The count each piece's list was asked at. */
  const asked = useRef(new Map<string, number>());
  return {
    of: (pieceKey) => lists.get(pieceKey),
    load(pieceKey, count) {
      if (asked.current.get(pieceKey) === count) return;
      asked.current.set(pieceKey, count);
      window.companion.feedsList({ pieceKey }).then(
        (ids) => {
          setLists((m) => new Map(m).set(pieceKey, ids));
        },
        () => {
          // Asked again the next time the list opens.
          asked.current.delete(pieceKey);
        },
      );
    },
  };
}
