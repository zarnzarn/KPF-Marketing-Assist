import type { MonthlyReport } from "@/lib/reports/types";

// MOCK sample monthly report. Every number is invented. It is shown only when
// no real report folder is configured, so the app still works on any computer.
export const mockMonthlyReport: MonthlyReport = {
  id: "mock-sample",
  title: "Sample Marketing Report (MOCK)",
  month: "",
  isMock: true,
  intro: [
    { type: "paragraph", text: "MOCK SAMPLE: invented numbers for layout testing." },
    {
      type: "kpis",
      items: [
        { label: "TOTAL SALES", value: "THB 500K", note: "+5.0% vs last month (mock)" },
        { label: "ONLINE SALES", value: "THB 150K", note: "+8.0% vs last month (mock)" },
        { label: "SUPERMARKET SALES", value: "THB 350K", note: "+3.0% vs last month (mock)" },
      ],
    },
  ],
  sections: [
    {
      number: 1,
      title: "Executive Summary",
      blocks: [
        { type: "bullets", items: ["Overall: total sales grew in the mock month.", "Online: website carried most online orders (mock)."] },
      ],
    },
    {
      number: 2,
      title: "Sales Highlights",
      blocks: [
        {
          type: "table",
          headers: ["Channel", "Last month", "This month", "Change"],
          rows: [
            ["Website", "90,000", "98,000", "+8.9%"],
            ["Line / Private", "45,000", "52,000", "+15.6%"],
            ["Supermarket total", "340,000", "350,000", "+2.9%"],
            ["Grand total", "475,000", "500,000", "+5.3%"],
          ],
        },
      ],
    },
    {
      number: 3,
      title: "Key Observation",
      blocks: [
        { type: "bullets", items: ["Supermarket and online both grew (mock).", "Checkout tracking is not set up yet, so conversion rate is not reported (mock note)."] },
      ],
    },
    {
      number: 4,
      title: "Action Plan",
      blocks: [
        {
          type: "table",
          headers: ["Action", "Owner", "Target"],
          rows: [["Plan next month's LINE broadcast (mock)", "Marketing", "Early next month"]],
        },
      ],
    },
  ],
};
