import { customers } from "@/data/mock";
import { Badge, Card, List, ListItem, PageHeader, Stat } from "@/components/ui";
import { CustomerTable } from "@/components/CustomerTable";
import { formatDate } from "@/lib/dates";
import { followUpsDue, openIssues, getCustomer, upcomingFollowUps } from "@/lib/queries";

export const metadata = { title: "Customers & B2B · Klong Phai Farm (Prototype)" };

export default function CustomersPage() {
  const count = (type: string) => customers.filter((c) => c.type === type).length;
  return (
    <>
      <PageHeader title="Customers & B2B" subtitle="Accounts, contacts and follow-ups. All names and contact details are fictional placeholders." />

      <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-6">
        <Stat label="Hotels" value={String(count("Hotel"))} />
        <Stat label="Restaurants" value={String(count("Restaurant"))} />
        <Stat label="Chefs" value={String(count("Chef"))} />
        <Stat label="Wholesale" value={String(count("Wholesale"))} />
        <Stat label="Retail partners" value={String(count("Retail Partner"))} />
        <Stat label="Corporate" value={String(count("Corporate"))} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card id="follow-ups" title="Follow-ups" subtitle="Due today or earlier, then upcoming">
          <List>
            {[...followUpsDue(), ...upcomingFollowUps()].map((c) => (
              <ListItem key={c.id}>
                <span>
                  <span className="block font-medium">{c.name}</span>
                  <span className="text-sm text-muted">Follow up {formatDate(c.followUpDate as string)}</span>
                </span>
                <Badge>{c.opportunity}</Badge>
              </ListItem>
            ))}
          </List>
        </Card>
        <Card id="issues" title="Open customer issues">
          <List>
            {openIssues().map((i) => (
              <ListItem key={i.id}>
                <span>
                  <span className="block font-medium">{i.title}</span>
                  <span className="text-sm text-muted">{getCustomer(i.customerId)?.name ?? "No customer linked"}</span>
                </span>
                <Badge>{i.severity}</Badge>
              </ListItem>
            ))}
          </List>
        </Card>
      </div>

      <Card id="accounts" title="Customer list and B2B accounts" className="mt-6">
        <CustomerTable customers={customers} />
      </Card>
    </>
  );
}
