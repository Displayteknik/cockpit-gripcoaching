// Delad markdown→PDF-renderare (jsPDF vektor). Används av djupgranskningen och sid-optimeraren.
// jsPDF inbyggd helvetica = bara Latin-1 → safe() mappar pilar/emoji och strippar övriga symboler,
// men bevarar general punctuation (•–—…"") som WinAnsi klarar.
export async function downloadMarkdownPdf(reportText: string, filename: string): Promise<void> {
  const GLYPH: Record<string, string> = { "→": "->", "←": "<-", "✅": "OK", "✔": "OK", "✓": "OK", "❌": "X", "✗": "X", "✘": "X", "⚠": "!" };
  const safe = (s: string) => s.replace(/[←-⇿⌀-➿⬀-⯿️\u{1F000}-\u{1FAFF}]/gu, (m) => GLYPH[m] ?? "");
  try {
    const { jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageW = 210, pageH = 297, mL = 14, mR = 14, mT = 16, mB = 16;
    const contentW = pageW - mL - mR;
    let y = mT;
    let firstHeading = true;
    const DARK: [number, number, number] = [31, 58, 95];
    const MID: [number, number, number] = [46, 89, 132];
    const TEXT: [number, number, number] = [31, 41, 55];
    const lh = (fs: number) => fs * 0.3528 * 1.34;
    const ensure = (h: number) => { if (y + h > pageH - mB) { doc.addPage(); y = mT; } };
    // Prioriterings-färg (emoji kan inte renderas i jsPDF → färga rubriken + rita prick i stället).
    const prioColor = (t: string): [number, number, number] | null => {
      if (/m[åa]ste/i.test(t)) return [197, 48, 48];   // röd
      if (/\bb[öo]r\b/i.test(t)) return [180, 120, 20]; // gul/amber
      if (/\bkan\b/i.test(t)) return [22, 128, 80];     // grön
      return null;
    };

    const parseInline = (s: string) => {
      s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1");
      const segs: { t: string; b: boolean; m: boolean }[] = [];
      const re = /(\*\*([^*]+)\*\*|`([^`]+)`)/g;
      let idx = 0, mt: RegExpExecArray | null;
      while ((mt = re.exec(s))) {
        if (mt.index > idx) segs.push({ t: s.slice(idx, mt.index), b: false, m: false });
        if (mt[2] != null) segs.push({ t: mt[2], b: true, m: false });
        else segs.push({ t: mt[3], b: false, m: true });
        idx = mt.index + mt[0].length;
      }
      if (idx < s.length) segs.push({ t: s.slice(idx), b: false, m: false });
      return segs.length ? segs : [{ t: s, b: false, m: false }];
    };

    const drawRich = (str: string, fs: number, x0: number, maxW: number) => {
      doc.setFontSize(fs); doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
      const lineH = lh(fs);
      const words: { w: string; b: boolean; m: boolean }[] = [];
      parseInline(str).forEach((sg) => sg.t.split(/(\s+)/).forEach((p) => { if (p !== "") words.push({ w: p, b: sg.b, m: sg.m }); }));
      ensure(lineH);
      let x = x0;
      const setF = (b: boolean, m: boolean) => doc.setFont(m ? "courier" : "helvetica", b ? "bold" : "normal");
      for (const wd of words) {
        setF(wd.b, wd.m);
        if (/^\s+$/.test(wd.w)) { x += doc.getTextWidth(wd.w); continue; }
        const ww = doc.getTextWidth(wd.w);
        if (x + ww > x0 + maxW && x > x0) { y += lineH; x = x0; ensure(lineH); }
        doc.text(wd.w, x, y); x += ww;
      }
      y += lineH;
    };

    const lines = safe(reportText).replace(/\r/g, "").split("\n");
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];

      if (/^```/.test(line)) {
        i++;
        const buf: string[] = [];
        while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++; }
        i++;
        doc.setFont("courier", "normal"); doc.setFontSize(8);
        const wrapped: string[] = [];
        buf.forEach((b) => { (doc.splitTextToSize(b === "" ? " " : b, contentW - 6) as string[]).forEach((w) => wrapped.push(w)); });
        const lineH = lh(8);
        let j = 0;
        while (j < wrapped.length) {
          let canLines = Math.floor((pageH - mB - y - 4) / lineH);
          if (canLines <= 0) { doc.addPage(); y = mT; canLines = Math.floor((pageH - mB - mT - 4) / lineH); }
          const chunk = wrapped.slice(j, j + canLines);
          const boxH = chunk.length * lineH + 4;
          doc.setFillColor(244, 244, 244); doc.rect(mL, y, contentW, boxH, "F");
          doc.setTextColor(40, 40, 40); doc.setFont("courier", "normal"); doc.setFontSize(8);
          let ty = y + 3 + lineH * 0.7;
          chunk.forEach((cl) => { doc.text(cl, mL + 3, ty); ty += lineH; });
          y += boxH + 2; j += chunk.length;
        }
        continue;
      }

      if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
        const head = line.split("|").slice(1, -1).map((c) => c.trim().replace(/\*\*/g, ""));
        i += 2;
        const rows: string[][] = [];
        while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) { rows.push(lines[i].split("|").slice(1, -1).map((c) => c.trim().replace(/\*\*/g, "").replace(/`/g, ""))); i++; }
        autoTable(doc, {
          startY: y,
          head: [head],
          body: rows,
          styles: { fontSize: 8, cellPadding: 2, overflow: "linebreak", textColor: TEXT, lineColor: [221, 221, 221], lineWidth: 0.1 },
          headStyles: { fillColor: DARK, textColor: [255, 255, 255], fontStyle: "bold" },
          alternateRowStyles: { fillColor: [245, 248, 251] },
          margin: { left: mL, right: mR },
          theme: "grid",
        });
        y = (((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY) ?? y) + 4;
        continue;
      }

      const hm = line.match(/^(#{1,6})\s+(.*)$/);
      if (hm) {
        const level = hm[1].length;
        const txt = hm[2].replace(/\*\*/g, "").replace(/`/g, "");
        if (level === 1) {
          if (!firstHeading) { doc.addPage(); y = mT; }
          firstHeading = false;
          y += 2; doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(DARK[0], DARK[1], DARK[2]);
          (doc.splitTextToSize(txt, contentW) as string[]).forEach((w) => { ensure(lh(16)); doc.text(w, mL, y + 5); y += lh(16); });
          doc.setDrawColor(DARK[0], DARK[1], DARK[2]); doc.setLineWidth(0.8); doc.line(mL, y + 1, pageW - mR, y + 1); y += 6;
        } else if (level === 2) {
          ensure(14); y += 3;
          const pc = prioColor(txt);
          doc.setFont("helvetica", "bold"); doc.setFontSize(13);
          doc.setTextColor(...(pc ?? MID));
          const tx = pc ? mL + 5 : mL;
          let firstLine = true;
          (doc.splitTextToSize(txt, contentW - (pc ? 5 : 0)) as string[]).forEach((w) => {
            ensure(lh(13));
            if (pc && firstLine) { doc.setFillColor(pc[0], pc[1], pc[2]); doc.circle(mL + 1.6, y + 2.6, 1.4, "F"); }
            doc.text(w, tx, y + 4); y += lh(13); firstLine = false;
          });
          doc.setDrawColor(225, 229, 235); doc.setLineWidth(0.3); doc.line(mL, y + 0.5, pageW - mR, y + 0.5); y += 4;
        } else {
          const fs = level === 3 ? 11 : 10;
          const pc = prioColor(txt);
          ensure(lh(fs) + 2); y += 2; doc.setFont("helvetica", "bold"); doc.setFontSize(fs);
          doc.setTextColor(...(pc ?? TEXT));
          (doc.splitTextToSize(txt, contentW) as string[]).forEach((w) => { ensure(lh(fs)); doc.text(w, mL, y + 3); y += lh(fs); });
          y += 2;
        }
        i++; continue;
      }

      if (/^---+\s*$/.test(line)) { ensure(4); doc.setDrawColor(225, 229, 235); doc.setLineWidth(0.3); doc.line(mL, y, pageW - mR, y); y += 4; i++; continue; }

      if (/^>\s?/.test(line)) {
        const buf: string[] = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, "")); i++; }
        const startY = y; y += 1.5;
        buf.forEach((b) => drawRich(b || " ", 10, mL + 5, contentW - 7));
        y += 1.5;
        doc.setDrawColor(MID[0], MID[1], MID[2]); doc.setLineWidth(1.2); doc.line(mL + 1.5, startY, mL + 1.5, y - 1.5); y += 2;
        continue;
      }

      if (/^\s*[-*]\s+/.test(line)) {
        while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
          const txt = lines[i].replace(/^\s*[-*]\s+/, ""); i++;
          doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
          ensure(lh(10)); doc.text("•", mL + 2, y);
          drawRich(txt, 10, mL + 6, contentW - 6);
        }
        y += 1; continue;
      }

      if (/^\s*\d+\.\s+/.test(line)) {
        let n = 1;
        while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
          const txt = lines[i].replace(/^\s*\d+\.\s+/, ""); i++;
          doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
          ensure(lh(10)); doc.text(`${n}.`, mL + 2, y); n++;
          drawRich(txt, 10, mL + 8, contentW - 8);
        }
        y += 1; continue;
      }

      if (/^\s*$/.test(line)) { y += 2; i++; continue; }

      const buf: string[] = [];
      while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^(#{1,6}\s|```|>\s?|\s*[-*]\s+|\s*\d+\.\s+|\s*\|)/.test(lines[i])) { buf.push(lines[i]); i++; }
      buf.forEach((b) => drawRich(b, 10, mL, contentW));
      y += 1.5;
    }
    doc.save(filename);
  } catch (e) {
    alert("Kunde inte skapa PDF: " + (e as Error).message);
  }
}
