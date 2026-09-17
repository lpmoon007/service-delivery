/** The preview registry. Replaced by database rows once Supabase is wired. */

import program from "../../programs/build-a-dream.json";
import { generateEngagement } from "@/lib/generate";
import type { EngagementParams, Program, RunOfShowOverrides } from "@/lib/types";
import {
  DEVRY,
  DEVRY_DELIVERY,
  DEVRY_OVERRIDES,
  LEDGEBROOK,
  LEDGEBROOK_DELIVERY,
} from "./known-events";

export const BUILD_A_DREAM = program as unknown as Program;

export interface KnownEngagement {
  slug: string;
  label: string;
  params: EngagementParams;
  deliveryDate: string;
  overrides: RunOfShowOverrides;
  resourceValues: Record<string, string>;
  costs: Record<string, { amount?: number; note?: string }>;
}

export const KNOWN_ENGAGEMENTS: KnownEngagement[] = [
  {
    slug: "ledgebrook",
    label: "Delivered 2026-09-16",
    params: LEDGEBROOK,
    deliveryDate: LEDGEBROOK_DELIVERY,
    overrides: {},
    resourceValues: {
      "beneficiary_site.org_name": "Garcia-Salesian Club",
      "transportation.vehicle_type": "Limousine",
      "post_event_delivery.destination": "Garcia-Salesian Club",
      "post_event_delivery.arrive_time": "approximately 7:00 PM",
      "venue.name": "Marriott",
    },
    costs: {
      transportation: {
        note: "Limousine for the Garcia-Salesian Club children. Paid, amount not yet recorded.",
      },
      technicians: { note: "One technician: venue inspection, then delivery to the club." },
    },
  },
  {
    slug: "devry",
    label: "Delivered 2011-12-09",
    params: DEVRY,
    deliveryDate: DEVRY_DELIVERY,
    overrides: DEVRY_OVERRIDES,
    resourceValues: {
      "venue.name": "Gaylord Palms Convention Center",
      "venue.address": "6000 West Osceola Parkway, Kissimmee, FL 34746",
      "venue.contact_name": "Heather Cochran, Convention Services Manager",
      "venue.contact_phone": "407-586-1512",
      "beneficiary_site.org_name": "Tangelo Park Elementary",
      "beneficiary_site.address": "5115 Anzio Street, Orlando, FL 32819",
      "beneficiary_site.contact_name": "Tashanda Brown",
      "beneficiary_site.contact_phone": "407-402-3367",
      "transportation.vendor": "Stylus Transportation",
      "transportation.vendor_phone": "407-850-9808",
      "transportation.confirmation_number": "4624",
      "transportation.pickup_time": "8:30 AM",
      "transportation.distance_mi": "12.5 miles / 25 minutes",
      "materials_transport.vendor": "U-Haul",
    },
    costs: {},
  },
];

export function findEngagement(slug: string): KnownEngagement | undefined {
  return KNOWN_ENGAGEMENTS.find((e) => e.slug === slug);
}

export function generated(e: KnownEngagement) {
  return generateEngagement(BUILD_A_DREAM, e.params, e.deliveryDate, e.overrides);
}
