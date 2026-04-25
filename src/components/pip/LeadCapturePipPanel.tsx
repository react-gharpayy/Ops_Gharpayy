import { QuickAddLeadPanel } from "@/components/leads/QuickAddLeadPanel";

export function LeadCapturePipPanel() {
  return <QuickAddLeadPanel open={true} onClose={() => undefined} />;
}