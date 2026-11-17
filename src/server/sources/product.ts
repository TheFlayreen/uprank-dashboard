import { getJson, mapWithConcurrency } from "./http";

// Shapes as returned by the product API (ISO date strings).

export interface ProductClient {
  id: string;
  business_name: string;
  trade: string | null;
  region: string | null;
  stripe_customer_id: string | null;
  status: string;
  signup_at: string;
  onboarding: {
    assets_received_at: string | null;
    site_approved_at: string | null;
    live_at: string | null;
  } | null;
  last_login_at: string | null;
  ads: { enabled: boolean; monthly_budget: number | null; enabled_at: string | null } | null;
}

export interface ProductLeadMonth {
  month: string;
  leads: number;
}

export interface ProductTicket {
  id: string;
  client_id: string;
  created_at: string;
  category: string;
  status: string;
}

interface Page<T> {
  data: T[];
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

export interface ProductData {
  clients: ProductClient[];
  leads: Record<string, ProductLeadMonth[]>;
  tickets: ProductTicket[];
  referenceDate: Date | null;
}

export function createProductClient(baseUrl: string, apiKey: string) {
  const headers = { "X-API-Key": apiKey };
  let referenceDate: Date | null = null;

  /** Page-number pagination. */
  async function listAll<T>(path: string) {
    const out: T[] = [];
    for (let page = 1; ; page++) {
      const qs = new URLSearchParams({ per_page: "100", page: String(page) });
      const res = await getJson<Page<T>>(`${baseUrl}${path}?${qs}`, headers);
      referenceDate ??= res.referenceDate;
      out.push(...res.body.data);
      if (page >= res.body.total_pages || res.body.data.length === 0) return out;
    }
  }

  return {
    async fetchAll(): Promise<ProductData> {
      const [clients, tickets] = await Promise.all([
        listAll<ProductClient>("/clients"),
        listAll<ProductTicket>("/support-tickets"),
      ]);

      // Leads are only available per client → N requests, bounded concurrency.
      const leadLists = await mapWithConcurrency(clients, 8, async (c) => {
        const res = await getJson<{ data: ProductLeadMonth[] }>(
          `${baseUrl}/clients/${encodeURIComponent(c.id)}/leads`,
          headers,
        );
        return [c.id, res.body.data ?? []] as const;
      });

      return { clients, tickets, leads: Object.fromEntries(leadLists), referenceDate };
    },
  };
}
