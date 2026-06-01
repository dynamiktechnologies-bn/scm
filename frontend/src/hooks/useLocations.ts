import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

export interface LocationOption {
  id: number;
  code: string;
  name: string | null;
  warehouse_id: number;
  warehouse_name: string | null;
}

export function useLocations() {
  return useQuery<LocationOption[]>({
    queryKey: ["locations"],
    queryFn: () => api.get("/warehouses/locations").then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });
}

export function locationLabel(loc: LocationOption) {
  return loc.warehouse_name
    ? `${loc.warehouse_name} › ${loc.code}${loc.name ? ` (${loc.name})` : ""}`
    : `${loc.code}${loc.name ? ` (${loc.name})` : ""}`;
}
