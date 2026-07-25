"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { Col } from "@/components/tables/songs-table-columns";
import type { SongSortKey } from "@/lib/types";

export function TableHeader({
  allSelected,
  someSelected,
  onSelectAll,
  visibleCols,
  gridTemplateColumns,
  sort,
  order,
  unplayedOnly,
  onToggleSort,
}: {
  allSelected: boolean;
  someSelected: boolean;
  onSelectAll: () => void;
  visibleCols: Col[];
  gridTemplateColumns: string;
  sort: SongSortKey;
  order: "ASC" | "DESC";
  unplayedOnly: boolean;
  onToggleSort: (key: SongSortKey) => void;
}) {
  return (
    <div
      className="grid items-center border-b border-border bg-background text-xs"
      style={{ gridTemplateColumns, height: 41 }}
    >
      <div className="pl-6">
        <Checkbox
          checked={allSelected}
          indeterminate={someSelected}
          onCheckedChange={onSelectAll}
          aria-label="Select all loaded"
        />
      </div>
      <div />
      {visibleCols.map((col) => {
        const active = col.sortKey !== null && sort === col.sortKey;
        return (
          <div
            key={col.id}
            className={cn("min-w-0 px-3", col.align === "right" && "flex justify-end")}
          >
            {col.sortKey === null || unplayedOnly ? (
              <span className="font-medium text-muted-foreground">{col.label}</span>
            ) : (
              <button
                onClick={() => onToggleSort(col.sortKey!)}
                className={cn(
                  "flex items-center gap-1 font-medium hover:text-foreground",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {col.label}
                {active &&
                  (order === "ASC" ? (
                    <ArrowUp className="size-3" />
                  ) : (
                    <ArrowDown className="size-3" />
                  ))}
              </button>
            )}
          </div>
        );
      })}
      <div />
    </div>
  );
}
