// TEST FIXTURES ONLY. Fictional data so tests can exercise the business logic.
// The app never imports anything from tests/.
import { EMPTY_USER_DATA, type AppData, type UserData } from "@/lib/types";
import { customers } from "./customers";
import { approvals, campaigns, contentItems } from "./marketing";
import { documents, issues, meetings, tasks } from "./operations";
import { products } from "./products";

export const FIXTURE_TODAY = "2026-10-06";

export const fixtureUserData: UserData = {
  tasks,
  meetings,
  customers,
  campaigns,
  content: contentItems,
  issues,
  approvals,
  documents,
};

export const fixtureData: AppData = { ...fixtureUserData, today: FIXTURE_TODAY, products };

export const emptyData = (today = FIXTURE_TODAY): AppData => ({ ...EMPTY_USER_DATA, today, products: [] });

export { approvals, campaigns, contentItems, customers, documents, issues, meetings, products, tasks };
