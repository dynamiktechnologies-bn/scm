import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import {
  PageHeader, TableSkeleton, EmptyState, Modal, FormField, Input, Select,
} from "../../components/ui";
import { Plus, Warehouse, MapPin, ChevronRight } from "lucide-react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useLocations, locationLabel, type LocationOption } from "../../hooks/useLocations";

interface WarehouseOut { id: number; code: string; name: string; is_active: boolean; }

export function WarehousesPage() {
  const qc = useQueryClient();
  const [showWHForm, setShowWHForm] = useState(false);
  const [showLocForm, setShowLocForm] = useState(false);
  const [editingWH, setEditingWH] = useState<WarehouseOut | null>(null);
  const [editingLoc, setEditingLoc] = useState<LocationOption | null>(null);

  const { data: warehouses, isLoading: whLoading } = useQuery<WarehouseOut[]>({
    queryKey: ["warehouses"],
    queryFn: () => api.get("/warehouses").then((r) => r.data),
  });
  const { data: locations, isLoading: locLoading } = useLocations();

  const locsByWarehouse = (whId: number) =>
    (locations ?? []).filter((l) => l.warehouse_id === whId);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Warehouses & Locations"
        subtitle="Manage where inventory is physically stored"
        actions={
          <div className="flex gap-2">
            <button
              className="btn-secondary"
              onClick={() => { setEditingLoc(null); setShowLocForm(true); }}
            >
              <MapPin size={14} /> New Location
            </button>
            <button
              className="btn-primary"
              onClick={() => { setEditingWH(null); setShowWHForm(true); }}
            >
              <Plus size={14} /> New Warehouse
            </button>
          </div>
        }
      />

      <div className="page-shell space-y-6">
        {/* Warehouses + their locations */}
        {whLoading ? (
          <div className="card overflow-hidden"><table className="data-table"><tbody><TableSkeleton cols={3} rows={3} /></tbody></table></div>
        ) : !warehouses?.length ? (
          <div className="card"><EmptyState message="No warehouses defined" icon={<Warehouse size={28} />} /></div>
        ) : (
          warehouses.map((wh) => (
            <div key={wh.id} className="card overflow-hidden">
              {/* Warehouse header */}
              <div className="flex items-center justify-between px-5 py-3 bg-slate-50/80 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
                    <Warehouse size={15} className="text-violet-600" />
                  </div>
                  <div>
                    <span className="font-semibold text-slate-800">{wh.name}</span>
                    <span className="ml-2 mono text-slate-400 text-xs">{wh.code}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">
                    {locsByWarehouse(wh.id).length} location{locsByWarehouse(wh.id).length !== 1 ? "s" : ""}
                  </span>
                  <button
                    className="btn-ghost py-1 text-xs"
                    onClick={() => { setEditingWH(wh); setShowWHForm(true); }}
                  >
                    Edit
                  </button>
                  <button
                    className="btn-secondary py-1 text-xs"
                    onClick={() => {
                      setEditingLoc(null);
                      setShowLocForm(true);
                      // Pre-select this warehouse in the form — handled via defaultValues trick
                      sessionStorage.setItem("newLocWarehouseId", String(wh.id));
                    }}
                  >
                    <MapPin size={11} /> Add Location
                  </button>
                </div>
              </div>

              {/* Locations table */}
              {locsByWarehouse(wh.id).length === 0 ? (
                <div className="px-5 py-6 text-sm text-slate-400 text-center">
                  No locations — add one to start receiving stock here.
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Location Code</th>
                      <th>Description</th>
                      <th>Full Path</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {locsByWarehouse(wh.id).map((loc) => (
                      <tr key={loc.id}>
                        <td>
                          <span className="mono bg-slate-100 px-2.5 py-1 rounded-md text-slate-700 font-semibold">
                            {loc.code}
                          </span>
                        </td>
                        <td className="text-slate-600">{loc.name ?? "—"}</td>
                        <td className="text-slate-500 text-xs">
                          <span className="flex items-center gap-1">
                            <Warehouse size={11} className="text-slate-400" />
                            {wh.name}
                            <ChevronRight size={11} className="text-slate-300" />
                            {loc.code}
                          </span>
                        </td>
                        <td>
                          <button
                            className="btn-ghost py-1 text-xs"
                            onClick={() => { setEditingLoc(loc); setShowLocForm(true); }}
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))
        )}
      </div>

      {showWHForm && (
        <WarehouseForm
          warehouse={editingWH}
          onClose={() => setShowWHForm(false)}
          onSaved={() => {
            setShowWHForm(false);
            qc.invalidateQueries({ queryKey: ["warehouses"] });
          }}
        />
      )}

      {showLocForm && (
        <LocationForm
          location={editingLoc}
          warehouses={warehouses ?? []}
          onClose={() => setShowLocForm(false)}
          onSaved={() => {
            setShowLocForm(false);
            qc.invalidateQueries({ queryKey: ["locations"] });
          }}
        />
      )}
    </div>
  );
}

function WarehouseForm({ warehouse, onClose, onSaved }: {
  warehouse: WarehouseOut | null; onClose: () => void; onSaved: () => void;
}) {
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: warehouse ?? { code: "", name: "" },
  });
  const mutation = useMutation({
    mutationFn: (data: any) =>
      warehouse
        ? api.put(`/warehouses/${warehouse.id}`, data)
        : api.post("/warehouses", data),
    onSuccess: () => { toast.success(warehouse ? "Warehouse updated" : "Warehouse created"); onSaved(); },
    onError: (e: any) => toast.error(e.response?.data?.detail ?? "Error"),
  });
  return (
    <Modal open size="sm" title={warehouse ? `Edit — ${warehouse.code}` : "New Warehouse"} onClose={onClose}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSubmit((d) => mutation.mutate(d))}>
            {mutation.isPending ? "Saving…" : "Save"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <FormField label="Code *" hint='Short identifier, e.g. "WH01"' error={errors.code?.message as string}>
          <Input {...register("code", { required: "Required" })} disabled={!!warehouse} placeholder="WH01" />
        </FormField>
        <FormField label="Name *" error={errors.name?.message as string}>
          <Input {...register("name", { required: "Required" })} placeholder="Main Warehouse" />
        </FormField>
      </div>
    </Modal>
  );
}

function LocationForm({ location, warehouses, onClose, onSaved }: {
  location: LocationOption | null; warehouses: WarehouseOut[]; onClose: () => void; onSaved: () => void;
}) {
  const preselect = sessionStorage.getItem("newLocWarehouseId") ?? "";
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: location
      ? { warehouse_id: String(location.warehouse_id), code: location.code, name: location.name ?? "" }
      : { warehouse_id: preselect, code: "", name: "" },
  });
  const mutation = useMutation({
    mutationFn: (data: any) => {
      const payload = { warehouse_id: parseInt(data.warehouse_id), code: data.code, name: data.name || null };
      return location
        ? api.put(`/warehouses/locations/${location.id}`, payload)
        : api.post("/warehouses/locations", payload);
    },
    onSuccess: () => {
      sessionStorage.removeItem("newLocWarehouseId");
      toast.success(location ? "Location updated" : "Location created");
      onSaved();
    },
    onError: (e: any) => toast.error(e.response?.data?.detail ?? "Error"),
  });
  return (
    <Modal open size="sm" title={location ? `Edit — ${location.code}` : "New Location"} onClose={onClose}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSubmit((d) => mutation.mutate(d))}>
            {mutation.isPending ? "Saving…" : "Save"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <FormField label="Warehouse *" error={errors.warehouse_id?.message as string}>
          <Select {...register("warehouse_id", { required: "Required" })} disabled={!!location}>
            <option value="">Select warehouse…</option>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
          </Select>
        </FormField>
        <FormField label="Location Code *" hint='e.g. "BIN-A1", "RACK-2B", "FLOOR-ZONE-3"' error={errors.code?.message as string}>
          <Input {...register("code", { required: "Required" })} disabled={!!location} placeholder="BIN-A1" />
        </FormField>
        <FormField label="Description" hint="Optional friendly name">
          <Input {...register("name")} placeholder="Aisle A - Bin 1" />
        </FormField>
      </div>
    </Modal>
  );
}
