"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase, type Vehicle } from "@/lib/supabase";
import { formatPrice } from "@/lib/utils";
import { Plus, Pencil, Trash2, Star, Search, X } from "lucide-react";

const CATEGORIES = [
  { value: "car", label: "Bil" },
  { value: "atv", label: "ATV" },
  { value: "utv", label: "UTV" },
  { value: "moped", label: "Moped" },
  { value: "slapvagn", label: "Släpvagn" },
  { value: "tradgard", label: "Trädgård" },
];

const emptyVehicle: Partial<Vehicle> = {
  title: "",
  slug: "",
  brand: "",
  model: "",
  category: "car",
  image_url: "",
  description: "",
  specs: {},
  price: 0,
  price_label: "",
  badge: "",
  is_featured: false,
  is_sold: false,
  sort_order: 0,
};

export default function DashboardPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [editing, setEditing] = useState<Partial<Vehicle> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [specsText, setSpecsText] = useState("");

  const loadVehicles = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("hm_vehicles")
      .select("*")
      .order("sort_order", { ascending: true });
    setVehicles(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadVehicles();
  }, [loadVehicles]);

  const filtered = vehicles.filter((v) => {
    if (filterCat !== "all" && v.category !== filterCat) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        v.title.toLowerCase().includes(s) ||
        v.brand?.toLowerCase().includes(s) ||
        v.model?.toLowerCase().includes(s)
      );
    }
    return true;
  });

  const openEdit = (vehicle: Vehicle) => {
    setEditing({ ...vehicle });
    setSpecsText(
      Object.entries(vehicle.specs || {})
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n")
    );
    setIsNew(false);
  };

  const openNew = () => {
    setEditing({ ...emptyVehicle });
    setSpecsText("");
    setIsNew(true);
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);

    // Parse specs from text
    const specs: Record<string, string> = {};
    specsText.split("\n").forEach((line) => {
      const [key, ...rest] = line.split(":");
      if (key && rest.length) {
        specs[key.trim()] = rest.join(":").trim();
      }
    });

    const payload = { ...editing, specs };

    // Auto-generate slug if empty
    if (!payload.slug && payload.title) {
      payload.slug = payload.title
        .toLowerCase()
        .replace(/[åä]/g, "a")
        .replace(/ö/g, "o")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
    }

    if (isNew) {
      const { error } = await supabase.from("hm_vehicles").insert(payload);
      if (error) alert("Fel: " + error.message);
    } else {
      const { error } = await supabase
        .from("hm_vehicles")
        .update(payload)
        .eq("id", editing.id);
      if (error) alert("Fel: " + error.message);
    }

    setSaving(false);
    setEditing(null);
    loadVehicles();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Är du säker på att du vill ta bort detta fordon?")) return;
    await supabase.from("hm_vehicles").delete().eq("id", id);
    loadVehicles();
  };

  const toggleFeatured = async (vehicle: Vehicle) => {
    await supabase
      .from("hm_vehicles")
      .update({ is_featured: !vehicle.is_featured })
      .eq("id", vehicle.id);
    loadVehicles();
  };

  const toggleSold = async (vehicle: Vehicle) => {
    await supabase
      .from("hm_vehicles")
      .update({ is_sold: !vehicle.is_sold })
      .eq("id", vehicle.id);
    loadVehicles();
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900">
            Fordon
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {vehicles.length} fordon totalt
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 bg-brand-blue hover:bg-brand-blue-dark text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nytt fordon
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Sök fordon..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none"
          />
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setFilterCat("all")}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterCat === "all"
                ? "bg-brand-blue text-white"
                : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
            }`}
          >
            Alla
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setFilterCat(cat.value)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterCat === cat.value
                  ? "bg-brand-blue text-white"
                  : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Vehicle list */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Laddar...</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                  Fordon
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                  Kategori
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                  Pris
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                  Status
                </th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                  Åtgärder
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((v) => (
                <tr key={v.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {v.image_url ? (
                        <img
                          src={v.image_url}
                          alt={v.title}
                          className="w-12 h-9 rounded object-cover bg-gray-100"
                        />
                      ) : (
                        <div className="w-12 h-9 rounded bg-gray-100" />
                      )}
                      <div>
                        <div className="font-medium text-sm text-gray-900">
                          {v.title}
                        </div>
                        {v.brand && (
                          <div className="text-xs text-gray-400">{v.brand}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                      {CATEGORIES.find((c) => c.value === v.category)?.label ||
                        v.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {v.price > 0 ? formatPrice(v.price) : v.price_label || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {v.is_featured && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                          Utvald
                        </span>
                      )}
                      {v.is_sold && (
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                          Såld
                        </span>
                      )}
                      {v.badge && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                          {v.badge}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => toggleFeatured(v)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          v.is_featured
                            ? "text-amber-500 bg-amber-50"
                            : "text-gray-400 hover:bg-gray-100"
                        }`}
                        title={v.is_featured ? "Ta bort utvald" : "Markera som utvald"}
                      >
                        <Star className="w-4 h-4" fill={v.is_featured ? "currentColor" : "none"} />
                      </button>
                      <button
                        onClick={() => openEdit(v)}
                        className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-brand-blue transition-colors"
                        title="Redigera"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(v.id)}
                        className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                        title="Ta bort"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              Inga fordon hittades
            </div>
          )}
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 px-4">
          <div
            className="fixed inset-0 bg-black/40"
            onClick={() => setEditing(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <h2 className="font-display font-bold text-lg">
                {isNew ? "Nytt fordon" : "Redigera fordon"}
              </h2>
              <button
                onClick={() => setEditing(null)}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Titel *
                  </label>
                  <input
                    type="text"
                    value={editing.title || ""}
                    onChange={(e) =>
                      setEditing({ ...editing, title: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Slug (URL)
                  </label>
                  <input
                    type="text"
                    value={editing.slug || ""}
                    onChange={(e) =>
                      setEditing({ ...editing, slug: e.target.value })
                    }
                    placeholder="auto-genereras"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Märke
                  </label>
                  <input
                    type="text"
                    value={editing.brand || ""}
                    onChange={(e) =>
                      setEditing({ ...editing, brand: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Modell
                  </label>
                  <input
                    type="text"
                    value={editing.model || ""}
                    onChange={(e) =>
                      setEditing({ ...editing, model: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Kategori
                  </label>
                  <select
                    value={editing.category || "car"}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        category: e.target.value as Vehicle["category"],
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bild-URL
                </label>
                <input
                  type="text"
                  value={editing.image_url || ""}
                  onChange={(e) =>
                    setEditing({ ...editing, image_url: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Beskrivning
                </label>
                <textarea
                  value={editing.description || ""}
                  onChange={(e) =>
                    setEditing({ ...editing, description: e.target.value })
                  }
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Pris (kr)
                  </label>
                  <input
                    type="number"
                    value={editing.price || 0}
                    onChange={(e) =>
                      setEditing({ ...editing, price: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Prisetikett
                  </label>
                  <input
                    type="text"
                    value={editing.price_label || ""}
                    onChange={(e) =>
                      setEditing({ ...editing, price_label: e.target.value })
                    }
                    placeholder="t.ex. 'Kontakta oss'"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Specifikationer (en per rad: Nyckel: Värde)
                </label>
                <textarea
                  value={specsText}
                  onChange={(e) => setSpecsText(e.target.value)}
                  rows={4}
                  placeholder="Årsmodell: 2024&#10;Mil: 150&#10;Bränsle: Bensin"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-mono focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Badge
                  </label>
                  <input
                    type="text"
                    value={editing.badge || ""}
                    onChange={(e) =>
                      setEditing({ ...editing, badge: e.target.value })
                    }
                    placeholder="t.ex. 'Nyhet'"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sortering
                  </label>
                  <input
                    type="number"
                    value={editing.sort_order || 0}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        sort_order: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none"
                  />
                </div>
                <div className="flex items-end gap-4 pb-1">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editing.is_featured || false}
                      onChange={(e) =>
                        setEditing({ ...editing, is_featured: e.target.checked })
                      }
                      className="rounded border-gray-300 text-brand-blue focus:ring-brand-blue"
                    />
                    Utvald
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editing.is_sold || false}
                      onChange={(e) =>
                        setEditing({ ...editing, is_sold: e.target.checked })
                      }
                      className="rounded border-gray-300 text-red-500 focus:ring-red-500"
                    />
                    Såld
                  </label>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 flex justify-end gap-3 rounded-b-2xl">
              <button
                onClick={() => setEditing(null)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Avbryt
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !editing.title}
                className="px-6 py-2 bg-brand-blue hover:bg-brand-blue-dark text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? "Sparar..." : isNew ? "Lägg till" : "Spara"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
