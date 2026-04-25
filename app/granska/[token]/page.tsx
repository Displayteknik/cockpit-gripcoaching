"use client";

import { useEffect, useState, use } from "react";
import { Check, X, MessageSquare, Loader2, Pencil, Send } from "lucide-react";

interface ShareLink {
  id: string;
  token: string;
  resource_type: string;
  resource_id: string;
  recipient_name: string | null;
  status: string;
  comment: string | null;
  expires_at: string | null;
}

interface SocialPost {
  hook: string;
  caption: string;
  hashtags: string;
  cta: string;
  platform: string;
  format: string;
  slides?: { number: number; headline: string; body: string; image_hint: string }[];
}

interface BlogPost {
  title: string;
  excerpt: string;
  content: string;
  image_url?: string;
}

export default function GranskaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [data, setData] = useState<{ link: ShareLink; client: { name: string; primary_color: string } | null; resource: SocialPost | BlogPost | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [editedCaption, setEditedCaption] = useState("");
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<"approved" | "rejected" | null>(null);

  useEffect(() => {
    fetch(`/api/share/${token}`).then(async (r) => {
      const d = await r.json();
      if (!r.ok) setError(d.error);
      else {
        setData(d);
        if (d.resource && "caption" in d.resource) setEditedCaption(d.resource.caption);
      }
      setLoading(false);
    });
  }, [token]);

  async function respond(action: "approve" | "reject" | "comment") {
    setSubmitting(true);
    const edits = editing && data?.resource && "caption" in data.resource ? { caption: editedCaption } : null;
    const r = await fetch(`/api/share/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, comment, edits }),
    });
    setSubmitting(false);
    if (r.ok && (action === "approve" || action === "reject")) setDone(action === "approve" ? "approved" : "rejected");
    else if (r.ok && action === "comment") alert("Kommentar skickad.");
  }

  if (loading) return <Center><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></Center>;
  if (error) return <Center><div className="text-gray-700">{error}</div></Center>;
  if (!data) return null;

  if (done) {
    return (
      <Center>
        <div className="text-center max-w-md">
          <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4 ${done === "approved" ? "bg-emerald-100" : "bg-red-100"}`}>
            {done === "approved" ? <Check className="w-8 h-8 text-emerald-600" /> : <X className="w-8 h-8 text-red-600" />}
          </div>
          <h1 className="font-display text-2xl font-bold text-gray-900 mb-2">
            {done === "approved" ? "Tack — godkänt!" : "Återkopplat"}
          </h1>
          <p className="text-gray-600">
            {done === "approved"
              ? `${data.client?.name || "Vi"} har fått din feedback och publicerar inom kort.`
              : `${data.client?.name || "Vi"} ser din återkoppling och hör av sig.`}
          </p>
        </div>
      </Center>
    );
  }

  const isSocial = data.link.resource_type === "social";
  const r = data.resource;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100" style={{ borderTopColor: data.client?.primary_color, borderTopWidth: 4 }}>
            <div className="text-xs text-gray-500 uppercase tracking-wide">{data.client?.name} · {isSocial ? "Granska inlägg" : "Granska artikel"}</div>
            <h1 className="font-display text-xl font-bold text-gray-900 mt-1">
              {isSocial ? `${(r as SocialPost)?.platform} — ${(r as SocialPost)?.format}` : (r as BlogPost)?.title}
            </h1>
            {data.link.recipient_name && <div className="text-sm text-gray-500 mt-0.5">Skickat till {data.link.recipient_name}</div>}
          </div>

          <div className="p-6 space-y-4">
            {isSocial && r && "caption" in r && (
              <>
                <div className="bg-purple-50 border-l-4 border-purple-400 px-3 py-2 rounded">
                  <div className="text-xs text-purple-700 font-medium mb-0.5">Hook (3 sek)</div>
                  <div className="text-gray-900 font-medium">{r.hook}</div>
                </div>

                {r.slides && r.slides.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-gray-700 uppercase tracking-wide">Slides</div>
                    {r.slides.map((s) => (
                      <div key={s.number} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                        <div className="text-xs text-gray-500">Slide {s.number}</div>
                        <div className="font-bold text-gray-900 mt-1">{s.headline}</div>
                        <div className="text-sm text-gray-700 mt-1">{s.body}</div>
                        <div className="text-xs text-gray-500 italic mt-1">📷 {s.image_hint}</div>
                      </div>
                    ))}
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-xs text-gray-500 uppercase tracking-wide">Bildtext</div>
                    <button onClick={() => setEditing(!editing)} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                      <Pencil className="w-3 h-3" />
                      {editing ? "Avbryt redigering" : "Föreslå ändring"}
                    </button>
                  </div>
                  {editing ? (
                    <textarea value={editedCaption} onChange={(e) => setEditedCaption(e.target.value)} rows={8} className="w-full px-3 py-2 rounded-lg border border-blue-300 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none" />
                  ) : (
                    <pre className="whitespace-pre-wrap text-sm text-gray-800 leading-relaxed font-body bg-gray-50 p-3 rounded-lg">{r.caption}</pre>
                  )}
                </div>

                {r.hashtags && <div className="text-xs text-blue-600">{r.hashtags}</div>}
                {r.cta && <div className="text-xs text-gray-500"><strong>CTA:</strong> {r.cta}</div>}
              </>
            )}

            {!isSocial && r && "content" in r && (
              <>
                {r.image_url && <img src={r.image_url} alt="" className="w-full rounded-lg" />}
                <div className="text-sm text-gray-600 italic">{r.excerpt}</div>
                <div className="prose prose-sm max-w-none text-gray-800" dangerouslySetInnerHTML={{ __html: r.content }} />
              </>
            )}

            <div className="border-t border-gray-100 pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Kommentar (valfritt)</label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                placeholder="Något du vill ändra eller säga?"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
              />
            </div>
          </div>

          <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex gap-2">
            <button
              onClick={() => respond("approve")}
              disabled={submitting}
              className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-lg font-semibold transition-colors disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              Godkänn
            </button>
            {(comment || editing) && (
              <button
                onClick={() => respond("comment")}
                disabled={submitting}
                className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-semibold transition-colors disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                Skicka kommentar
              </button>
            )}
            <button
              onClick={() => respond("reject")}
              disabled={submitting}
              className="flex items-center justify-center gap-2 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 px-4 py-2.5 rounded-lg font-semibold transition-colors disabled:opacity-50"
            >
              <X className="w-4 h-4" />
              Avvisa
            </button>
          </div>
        </div>
        <div className="text-center text-xs text-gray-400 mt-4">
          Säker delningslänk · går ut {data.link.expires_at ? new Date(data.link.expires_at).toLocaleDateString("sv-SE") : "—"}
        </div>
      </div>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center bg-gray-50">{children}</div>;
}
