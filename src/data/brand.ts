import type { BrandRule } from "@/lib/types";

// Klong Phai Farm brand and content rules, taken from the brand's own guide
// (Klong Phai Farm marketing skill). Rules only: no product facts, prices,
// certifications or results are stored here.
export const brandRules: BrandRule[] = [
  { id: "br-voice", rule: "Write like the people who raise the animals, not like a brand deck: honest, warm, calm, short sentences next to long ones." },
  { id: "br-no-filler", rule: "No sentence that exists only to sound premium. If a line can be deleted without losing meaning, delete it." },
  { id: "br-dashes", rule: "Do not use em dashes or en dashes. Use full stops, commas or a new sentence. Number ranges use a short hyphen, e.g. 35-45." },
  { id: "br-claims", rule: "Claims describe farming practice, never health outcomes. No health claims without certification backing." },
  { id: "br-hormones", rule: "Do not write a bare 'hormone-free' claim: Thai law bans growth hormones on every farm. Describe what the farm does instead." },
  { id: "br-words", rule: "Avoid cheap, budget or mass-market wording. Do not invent claims, certifications, awards, prices, availability or results." },
  { id: "br-colors", rule: "Brand colours: Espresso Brown #241905, Ivory Cream #F4EFE3, Forest Green #1F3D2A, Warm Gold #B59767. Never pure white or pure black." },
  { id: "br-sponsored", rule: "Disclose sponsored content (#ad / #สปอนเซอร์). Respect PDPA when collecting customer data." },
  { id: "br-approval", rule: "Anything published, sent or repriced needs the Marketing Director's approval first." },
];
