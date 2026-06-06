# -*- coding: utf-8 -*-
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Preformatted, Table, TableStyle
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT

ACCENT = colors.HexColor("#0F9D72")      # teal/grön
DARK = colors.HexColor("#111827")
GRAY = colors.HexColor("#4B5563")
LIGHT = colors.HexColor("#F3F4F6")
BORDER = colors.HexColor("#E5E7EB")

OUT = r"C:\Users\hakan\Downloads\Sparning-Ledarskapskultur.pdf"

styles = getSampleStyleSheet()

def S(name, **kw):
    base = kw.pop("parent", styles["Normal"])
    return ParagraphStyle(name, parent=base, **kw)

brand = S("brand", fontName="Helvetica-Bold", fontSize=9, textColor=ACCENT, spaceAfter=2, leading=11)
h1 = S("h1", fontName="Helvetica-Bold", fontSize=20, textColor=DARK, spaceAfter=4, leading=24)
sub = S("sub", fontName="Helvetica", fontSize=10.5, textColor=GRAY, spaceAfter=14, leading=15)
h2 = S("h2", fontName="Helvetica-Bold", fontSize=13, textColor=DARK, spaceBefore=14, spaceAfter=5, leading=16)
body = S("body", fontName="Helvetica", fontSize=10.5, textColor=DARK, spaceAfter=6, leading=15)
small = S("small", fontName="Helvetica", fontSize=9, textColor=GRAY, leading=13, spaceAfter=4)
code = S("code", fontName="Courier", fontSize=7.6, textColor=DARK, leading=10.5)
promptstyle = S("prompt", fontName="Helvetica-Oblique", fontSize=9.5, textColor=DARK, leading=14)

def esc(t):
    return t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

def codebox(text, style=code, bg=LIGHT):
    # Preformatted i denna reportlab-version avkodar INTE entiteter -> skicka rå text
    pre = Preformatted(text, style)
    t = Table([[pre]], colWidths=[165*mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), bg),
        ("BOX", (0, 0), (-1, -1), 0.6, BORDER),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
    ]))
    return t

def promptbox(text):
    p = Paragraph(text, promptstyle)
    t = Table([[p]], colWidths=[165*mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#ECFDF5")),
        ("LINEBEFORE", (0, 0), (0, -1), 3, ACCENT),
        ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#D1FAE5")),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
    ]))
    return t

SNIPPET = """<!-- Cockpit trafikspårning -->
<script>
  (function () {
    fetch('https://cockpit.gripcoaching.se/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: '440e6cf2-ae93-4ab8-9515-2f738861ef31',
        path: location.pathname,
        referrer: document.referrer || null
      }),
      keepalive: true
    }).catch(function () {});
  })();
</script>"""

PROMPT = ('"Jag har en webbplats (ledarskapskultur.se) byggd i [WordPress / Wix / '
          'Squarespace / annat]. Jag vill lägga in en spårnings-kodsnutt i &lt;head&gt; '
          'så den körs på alla sidor. Här är koden: [klistra in koden från rutan ovan]. '
          'Visa mig steg för steg exakt var jag klistrar in den för min plattform, '
          'och hur jag kontrollerar att den laddas."')

story = []
story.append(Paragraph("GRIPCOACHING · COCKPIT", brand))
story.append(Paragraph("Spårning för din dashboard", h1))
story.append(Paragraph("En liten kodsnutt — en gång — så kan vi följa trafiken på din sajt "
                       "och bygga din uppföljnings-dashboard.", sub))

story.append(Paragraph("1. Vad du ska lägga in", h2))
story.append(Paragraph("Kopiera hela kodrutan nedan. Den skickar anonym besöksdata "
                       "(vilka sidor som besöks och varifrån) till din dashboard. "
                       "Inga personuppgifter, inga cookies.", body))
story.append(Spacer(1, 4))
story.append(codebox(SNIPPET))

story.append(Paragraph("2. Var den ska in", h2))
story.append(Paragraph("Klistra in koden i sidans <b>&lt;head&gt;</b> (eller precis före "
                       "<b>&lt;/body&gt;</b>). Ligger den i sidans mall/template gäller den "
                       "hela sajten automatiskt.", body))
story.append(Paragraph("• <b>WordPress:</b> använd ett tillägg som \"Insert Headers and Footers\" "
                       "(WPCode) och klistra in i \"Header\".<br/>"
                       "• <b>Wix / Squarespace:</b> Inställningar → Custom code / Code injection → Header.<br/>"
                       "• <b>Egen kod:</b> lägg den i &lt;head&gt; i din layout-fil.", small))

story.append(Paragraph("3. Vill du att Claude gör det åt dig?", h2))
story.append(Paragraph("Du kan låta Claude (eller din webbansvariga) sköta det. "
                       "Kopiera texten nedan, byt ut plattformen, och klistra in koden från ruta 1 där det står:", body))
story.append(Spacer(1, 4))
story.append(promptbox(PROMPT))

story.append(Spacer(1, 12))
story.append(Paragraph("När koden är inne — säg till Håkan. Vi ser direkt i Cockpit när första "
                       "besöket kommer in, och då tänds din dashboard. "
                       "Vill du även ha heatmaps och Google-data kopplar vi på det sen, "
                       "utan att du behöver röra sajten igen.", small))

doc = SimpleDocTemplate(OUT, pagesize=A4,
                        leftMargin=22*mm, rightMargin=22*mm,
                        topMargin=20*mm, bottomMargin=18*mm,
                        title="Spårning för din dashboard - Ledarskapskultur",
                        author="GripCoaching")
doc.build(story)
print("OK ->", OUT)
