import { useMemo } from "react";
import { ARMORY_CAT_ORDER } from "@/lib/armory.catalog";

export function useCategoryGroups<T>(
  items: T[],
  getCategory: (item: T) => string | null
): { orderedGroups: [string, T[]][] } {
  const orderedGroups = useMemo(() => {
    const map = new Map<string, T[]>();

    for (const item of items) {
      const cat = getCategory(item);
      if (!cat) continue;
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(item);
    }

    const result: [string, T[]][] = [];
    for (const cat of ARMORY_CAT_ORDER) {
      const group = map.get(cat);
      if (group && group.length > 0) {
        result.push([cat, group]);
      }
    }

    // Append any categories not in ARMORY_CAT_ORDER at the end
    for (const [cat, group] of map) {
      if (!ARMORY_CAT_ORDER.includes(cat as any) && group.length > 0) {
        result.push([cat, group]);
      }
    }

    return result;
  }, [items, getCategory]);

  return { orderedGroups };
}
