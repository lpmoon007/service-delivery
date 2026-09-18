/**
 * The two real Build A Dream events, plus the clock times printed on their
 * source documents. These are the regression fixtures: if a change to the
 * template or the engine stops reproducing these, the change is wrong.
 *
 * Sources:
 *   Ledgebrook_9-16-26_BAD_Run_of_Show.pdf  (2026-09-16)
 *   Building_a_Dream_Agenda.pages.pdf       (DeVry, 2011-12-09)
 */

import type { EngagementParams, RunOfShowOverrides } from "@/lib/types";

export const LEDGEBROOK: EngagementParams = {
  client: "Ledgebrook",
  program: "BAD",
  participants: 75,
  teams: 13,
  beneficiaries: 13,
  beneficiary_org: "Garcia-Salesian Club",
  beneficiary_minors: true,
  beneficiary_travels: true,
  bikes_go_home_same_day: false,
  event_start: "15:15",
  beneficiary_depart_by: "17:00",
  venue_name: "Marriott",
  sponsor: "Bre",
  facilitator: "James Carter",
};

export const LEDGEBROOK_DELIVERY = "2026-09-16";

/** Main-track times as printed on the Ledgebrook run of show. */
export const LEDGEBROOK_MAIN: Record<string, [string, string]> = {
  arrival: ["3:15 PM", "3:30 PM"],
  opening: ["3:30 PM", "3:35 PM"],
  content: ["3:35 PM", "4:00 PM"],
  build: ["4:00 PM", "4:30 PM"],
  reveal: ["4:30 PM", "4:35 PM"],
  present: ["4:35 PM", "4:50 PM"],
  photo: ["4:50 PM", "4:55 PM"],
  tunnel: ["4:55 PM", "4:58 PM"],
  reset: ["4:58 PM", "5:02 PM"],
  debrief: ["5:02 PM", "5:22 PM"],
  challenge: ["5:22 PM", "5:26 PM"],
  close: ["5:26 PM", "5:30 PM"],
};

/** Children's-track times as printed on the Ledgebrook run of show. */
export const LEDGEBROOK_BENEFICIARY: Record<string, string> = {
  depart_origin: "3:15 PM",
  arrive_venue: "3:45 PM",
  sizing: "4:15 PM",
  send_rep: "4:15 PM",
  enter: "4:30 PM",
  gear: "4:40 PM",
  return: "4:58 PM",
  depart_venue: "5:00 PM",
};

export const DEVRY: EngagementParams = {
  client: "DeVry",
  program: "BAD",
  participants: 110,
  teams: 108,
  beneficiaries: 108,
  beneficiary_org: "Tangelo Park Elementary",
  beneficiary_minors: true,
  beneficiary_travels: true,
  bikes_go_home_same_day: false,
  event_start: "8:45",
  beneficiary_depart_by: null,
  venue_name: "Gaylord Palms Convention Center",
};

export const DEVRY_DELIVERY = "2011-12-09";

/**
 * The 2011 program ran a slightly different shape: a 30-minute content block
 * and a 25-minute build, no separate group-photograph or room-reset block, a
 * 5-minute tunnel and a 25-minute debrief. Same spine, different durations,
 * which is exactly what per-engagement overrides are for.
 */
export const DEVRY_OVERRIDES: RunOfShowOverrides = {
  durations: { content: 30, build: 25, tunnel: 5, debrief: 25 },
  skip: ["photo", "reset"],
};

/** Times printed on the DeVry agenda. */
export const DEVRY_MAIN: Record<string, [string, string]> = {
  arrival: ["8:45 AM", "9:00 AM"],
  opening: ["9:00 AM", "9:05 AM"],
  reveal: ["10:00 AM", "10:05 AM"],
  present: ["10:05 AM", "10:20 AM"],
};

/** Resource counts stated on the DeVry agenda. */
export const DEVRY_STATED = {
  buses: 3,
  mechanics: 4,
  bikes: 110,
  briefSheets: 110,
  materialsVan: true,
};

/**
 * Cologix, 2026-10-19. Inspiring Minds.
 *
 * Numbers as JC stated them: 40 participants, 20 children, 7 to 8 teachers
 * from other schools. Two things about that do not fit the program's own spec
 * and are asserted here so they stay visible rather than being quietly
 * smoothed over:
 *
 *  - The program is built on three adults per child. 40 over 20 is two.
 *  - 20 children is four pods, and four pods calls for 60 participants.
 *
 * "Other schools", plural, also suggests more than one partner organization,
 * and each one is entitled to a classroom collection.
 */
export const COLOGIX: EngagementParams = {
  client: "Cologix",
  program: "IM",
  variation: "The Long Current",
  format: "Department day",
  participants: 40,
  teams: 0,
  beneficiaries: 20,
  partner_orgs: 1,
  chaperones: 8,
  beneficiary_org: "TBC",
  beneficiary_minors: true,
  beneficiary_travels: true,
  stage_led_reversal: false,
  dimmable_room: false,
  event_start: "13:00",
  beneficiary_depart_by: null,
};

export const COLOGIX_DELIVERY = "2026-10-19";
