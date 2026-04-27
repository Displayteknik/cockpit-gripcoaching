"use client";

import { useState, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";

interface PixabayHit {
  id: number;
  preview: string;
  web: string;
  large: string;
  tags: string;
  user: string;
}

interface ImageFieldProps {
  value: string;
  onChange: (value: string) => void;
  bucket?: string;
}

export function ImageField({ value, onChange, bucket = "page-images" }: ImageFieldProps) {
  const [tab, setTab] = useState<"url" | "upload" | "search">("url");
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PixabayHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Upload to Supabase Storage
  const uploadFile = useCallback(async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const name = `editor/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from(bucket).upload(name, file, {
        cacheControl: "3600",
        upsert: false,
      });

      if (error) {
        // Fallback — försök vehicle-images
        const { error: err2 } = await supabase.storage.from("vehicle-images").upload(name, file, {
          cacheControl: "3600",
          upsert: false,
        });
        if (err2) {
          alert("Uppladdning misslyckades: " + err2.message);
          return;
        }
        const { data: urlData } = supabase.storage.from("vehicle-images").getPublicUrl(name);
        onChange(urlData.publicUrl);
      } else {
        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(name);
        onChange(urlData.publicUrl);
      }
    } finally {
      setUploading(false);
    }
  }, [onChange, bucket]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) uploadFile(file);
  }, [uploadFile]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  }, [uploadFile]);

  // Pixabay search
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/images/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      setSearchResults(data.hits || []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [searchQuery]);

  return (
    <div className="space-y-2">
      {/* Preview */}
      {value && (
        <div className="relative group">
          <img
            src={value}
            alt=""
            className="w-full h-24 object-cover rounded-lg border border-gray-200"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            ✕
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {(["url", "upload", "search"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-[11px] font-medium border-b-2 transition-all ${
              tab === t ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "url" ? "URL" : t === "upload" ? "Ladda upp" : "Sök bilder"}
          </button>
        ))}
      </div>

      {/* URL tab */}
      {tab === "url" && (
        <input
          type="text"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://example.com/bild.jpg"
          className="w-full px-2 py-1.5 rounded-md border border-gray-200 text-xs font-mono focus:border-blue-400 focus:outline-none"
        />
      )}

      {/* Upload tab */}
      {tab === "upload" && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all ${
            dragOver ? "border-blue-400 bg-blue-50" : "border-gray-300 hover:border-gray-400"
          }`}
        >
          {uploading ? (
            <div className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-gray-500">Laddar upp...</span>
            </div>
          ) : (
            <>
              <div className="text-2xl mb-1">📁</div>
              <p className="text-xs text-gray-500">Dra hit en bild eller klicka</p>
              <p className="text-[10px] text-gray-400 mt-1">JPG, PNG, WebP, SVG</p>
            </>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      )}

      {/* Search tab (Pixabay) */}
      {tab === "search" && (
        <div className="space-y-2">
          <div className="flex gap-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Sök gratis bilder..."
              className="flex-1 px-2 py-1.5 rounded-md border border-gray-200 text-xs focus:border-blue-400 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleSearch}
              disabled={searching}
              className="px-3 py-1.5 bg-blue-500 text-white text-xs rounded-md hover:bg-blue-600 disabled:opacity-50 transition-colors"
            >
              {searching ? "..." : "Sök"}
            </button>
          </div>

          {searchResults.length > 0 && (
            <div className="grid grid-cols-3 gap-1 max-h-48 overflow-y-auto rounded-lg">
              {searchResults.map((hit) => (
                <button
                  key={hit.id}
                  type="button"
                  onClick={() => { onChange(hit.large); setSearchResults([]); }}
                  className="relative group overflow-hidden rounded-md"
                  title={hit.tags}
                >
                  <img
                    src={hit.preview}
                    alt={hit.tags}
                    className="w-full h-16 object-cover hover:scale-110 transition-transform"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                    <span className="text-white text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity">Välj</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          <p className="text-[9px] text-gray-400 text-center">Bilder från Pixabay (gratis att använda)</p>
        </div>
      )}
    </div>
  );
}
