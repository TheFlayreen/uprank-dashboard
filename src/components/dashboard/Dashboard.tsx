import { Section } from "@/components/ui/Section";
import type { Dashboard as DashboardData } from "@/server/dashboard";
import { AdsView } from "./ads/AdsView";
import { BriefingPanel } from "./BriefingPanel";
import { CallList } from "./call-list/CallList";
import { DashboardHeader } from "./DashboardHeader";
import { DataQualityPanel } from "./DataQualityPanel";
import { EarlyWarningView } from "./early-warning/EarlyWarningView";
import { EconomicsView } from "./economics/EconomicsView";
import { KpiRow } from "./KpiRow";
import { LeadsByTradeChart } from "./leads/LeadsByTradeChart";
import { RetentionView } from "./retention/RetentionView";
import { SectionSidebar } from "./SectionSidebar";
import { SectionTabs } from "./SectionTabs";
import { SetupNeeded } from "./SetupNeeded";

export interface DashboardProps {
  /** Started by the page; awaited here so the page shell can stream first. */
  data: Promise<DashboardData>;
}

/** The whole page, in decision order: read this first → act → understand why → where to invest. */
export async function Dashboard({ data }: DashboardProps) {
  let d: DashboardData;
  try {
    d = await data;
  } catch (err) {
    return <SetupNeeded message={String(err)} />;
  }

  return (
    <div className="lg:grid lg:grid-cols-[176px_minmax(0,1fr)] lg:gap-12">
      <aside className="hidden lg:block">
        <SectionSidebar />
      </aside>
      <div className="min-w-0 space-y-10 sm:space-y-14">
        <div id="overview" className="scroll-mt-20 space-y-8 sm:space-y-10">
          <DashboardHeader
            referenceDate={d.referenceDate}
            syncedAt={d.lastSync?.finishedAt ?? null}
          />
          <KpiRow overview={d.overview} />
          <BriefingPanel briefing={d.briefing} />
        </div>
        <SectionTabs />

        <Section
          id="call-list"
          eyebrow="Act now"
          title={`Who should we call this week? (${d.overview.callThisWeek})`}
          insight="Highest risk first; ties go to the higher-paying client. Filter by the kind of conversation you're about to have."
        >
          <CallList rows={d.health.callList} />
        </Section>

        <Section
          id="early-warning"
          eyebrow="Early warning · bonus"
          title="Leads collapse about a month before clients cancel"
          insight={d.earlyWarning.insight}
        >
          <EarlyWarningView data={d.earlyWarning} />
        </Section>

        <Section
          id="retention"
          eyebrow="Retention"
          title="Which clients are we keeping, and when do we lose them?"
          insight={d.retention.insight}
        >
          <RetentionView data={d.retention} />
        </Section>

        <Section
          id="leads"
          eyebrow="Results"
          title="Do some trades get better results?"
          insight={d.leads.insight}
        >
          <LeadsByTradeChart data={d.leads} />
        </Section>

        <Section
          id="economics"
          eyebrow="Unit economics"
          title="Which trades are the best business?"
          insight={d.economics.insight}
        >
          <EconomicsView data={d.economics} />
        </Section>

        <Section
          id="ads"
          eyebrow="Ads add-on"
          title="Is the ads add-on worth pushing?"
          insight={d.ads.verdict}
        >
          <AdsView data={d.ads} />
        </Section>

        <DataQualityPanel data={d.dataQuality} />
      </div>
    </div>
  );
}
