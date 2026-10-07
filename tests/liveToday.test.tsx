// "Today" must move on when the tab is left open past midnight in Thailand.
// The later of the server's date and this computer's date is used.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppDataProvider, useAppData } from "@/components/AppDataProvider";

function ShowToday() {
  return <p data-testid="today">{useAppData().data.today}</p>;
}

afterEach(() => vi.useRealTimers());

describe("live today", () => {
  it("keeps the server's date, then switches when the date in Thailand changes", () => {
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
    vi.setSystemTime(new Date("2026-10-06T16:30:00Z")); // 23:30 on 6 Oct in Thailand
    render(
      <AppDataProvider today="2026-10-06">
        <ShowToday />
      </AppDataProvider>,
    );
    expect(screen.getByTestId("today")).toHaveTextContent("2026-10-06");

    vi.setSystemTime(new Date("2026-10-06T17:05:00Z")); // 00:05 on 7 Oct in Thailand
    act(() => {
      fireEvent.focus(window);
    });
    expect(screen.getByTestId("today")).toHaveTextContent("2026-10-07");

    // The once-a-minute check also catches it without any focus change.
    vi.setSystemTime(new Date("2026-10-07T17:01:00Z")); // 00:01 on 8 Oct in Thailand
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByTestId("today")).toHaveTextContent("2026-10-08");
  });

  it("uses the new day at once when the page was served just before midnight and opened just after", () => {
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
    vi.setSystemTime(new Date("2026-10-06T17:01:00Z")); // 00:01 on 7 Oct in Thailand
    render(
      <AppDataProvider today="2026-10-06">
        <ShowToday />
      </AppDataProvider>,
    );
    expect(screen.getByTestId("today")).toHaveTextContent("2026-10-07");
  });

  it("keeps the server's date when this computer's clock is behind", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-04T05:00:00Z"));
    render(
      <AppDataProvider today="2026-10-06">
        <ShowToday />
      </AppDataProvider>,
    );
    expect(screen.getByTestId("today")).toHaveTextContent("2026-10-06");
  });
});
