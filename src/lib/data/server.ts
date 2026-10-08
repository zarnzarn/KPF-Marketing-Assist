import "server-only";
// Server data for pages, always behind the login check. Pages call these, never the loaders directly,
// so channel numbers and report contents are only ever read for the allowed user.
import { requireViewer } from "../auth/session";
import { loadChannels } from "../channels/loadChannels";
import type { ChannelSnapshot } from "../channels/types";
import { loadReports } from "../reports/loadReports";
import { loadOnlineReports } from "../reports/onlineReports";
import type { ReportLoadResult } from "../reports/types";

export async function viewerChannels(): Promise<ChannelSnapshot[]> {
  await requireViewer();
  return loadChannels();
}

/** Online: the reports uploaded in the app. Local: the report folder on this computer (REPORTS_DIR). */
export async function viewerReports(): Promise<ReportLoadResult> {
  const viewer = await requireViewer();
  return viewer.mode === "online" ? loadOnlineReports() : loadReports();
}
