import { sendGAEvent } from "@next/third-parties/google";

export type AnalyticsEvent =
  | "sign_up"
  | "lane_added"
  | "trial_started"
  | "upgrade_clicked"
  | "checkout_started"
  | "subscription_created"
  | "report_requested"
  | "report_shared"
  | "demo_booked"
  | "paywall_gate_shown"
  | "paywall_gate_converted"
  | "feature_used"
  | "annual_upsell_clicked";

export function trackEvent(event: AnalyticsEvent, properties?: Record<string, unknown>) {
  sendGAEvent("event", event, properties ?? {});
}
