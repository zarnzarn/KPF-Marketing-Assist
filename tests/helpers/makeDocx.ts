import JSZip from "jszip";

// Builds a tiny SYNTHETIC Word file for tests. No real report is ever used in tests.
export type DocxPart = { p: string; bold?: boolean } | { table: string[][] } | { cellsOf: string[][] };

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const para = (text: string, bold = false) => `<w:p><w:r>${bold ? "<w:rPr><w:b/></w:rPr>" : ""}<w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p>`;

export async function makeDocx(parts: DocxPart[]): Promise<Buffer> {
  const body = parts
    .map((part) => {
      if ("p" in part) return para(part.p, part.bold);
      if ("table" in part) {
        // each row is a list of single-line cells
        return `<w:tbl><w:tblPr/>${part.table.map((row) => `<w:tr>${row.map((c) => `<w:tc>${para(c)}</w:tc>`).join("")}</w:tr>`).join("")}</w:tbl>`;
      }
      // one row; each cell holds several paragraphs (used for KPI tiles and callouts)
      return `<w:tbl><w:tblPr/><w:tr>${part.cellsOf.map((lines) => `<w:tc>${lines.map((l) => para(l)).join("")}</w:tc>`).join("")}</w:tr></w:tbl>`;
    })
    .join("");

  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  zip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`);
  return zip.generateAsync({ type: "nodebuffer" });
}

/** A realistic, fully invented monthly report in the same layout as the real ones. */
export function sampleReportParts(monthText = "1-30 September 2026"): DocxPart[] {
  return [
    { p: "KLONG PHAI FARM", bold: true },
    { p: `Marketing Report ${monthText}` },
    { p: "1  Executive Summary", bold: true },
    { cellsOf: [["TOTAL SALES", "THB 111K", "+1.0% vs last month"], ["ONLINE SALES", "THB 22K", "+2.0% vs last month"], ["SUPERMARKET SALES", "THB 89K", "+3.0% vs last month"]] },
    { p: "•  Overall: invented summary line one." },
    { p: "•  Online: invented summary line two." },
    { p: "2  Sales Highlights", bold: true },
    { table: [["Channel", "Prev", "Now", "Change"], ["Website", "10,000", "12,000", "+20.0%"], ["Supermarket total", "90,000", "89,000", "-1.1%"], ["Grand total", "100,000", "101,000", "+1.0%"]] },
    { p: "•  Good news: invented." },
    { p: "4 of 6 branches grew in this invented month." },
    { p: "4  Website Performance", bold: true },
    { p: "Checkout tracking is not set up yet, so conversion rate is not reported this month." },
    { p: "7  Key Observation", bold: true },
    { p: "•  Invented observation A." },
    { p: "•  Invented observation B." },
    { p: "8  Action Plan", bold: true },
    { table: [["Action", "Owner", "Target"], ["Send invented broadcast", "Marketing", "Early Oct"]] },
    { p: "9  Bottom Line", bold: true },
    { cellsOf: [["Bottom Line for Someone", "•  Invented bottom line one.", "•  Invented bottom line two."]] },
  ];
}
