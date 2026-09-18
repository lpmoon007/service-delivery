/**
 * Author the give-back program templates that share a spine.
 *
 * Build A Dream and Inspiring Minds were written by hand from full source
 * documents. Housewarming, Get On Board and 60 Seconds to Give come from the
 * 2026 experience catalogue, which gives a one-line description, a duration
 * band and the shared "How it works" terms and nothing else. Their commercial
 * and coordination phases are genuinely the same work, so the shared scaffold
 * below is real rather than a shortcut, and each program then states what only
 * it needs.
 *
 * Everything the catalogue does not state carries a confidence below "high" and
 * a note, so it surfaces on the coordination doc as "confirm" rather than
 * passing as fact. Run:
 *
 *   npx tsx scripts/author-programs.ts
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";

import type { CostLine, Program, TaskRule } from "../src/lib/types";

const OUT = join(import.meta.dirname, "..", "programs");

/** Catalogue terms that apply to every give-back experience. */
const CATALOGUE = {
  leadTimeNote:
    "The catalogue states four to twelve weeks' lead time is ideal. Offsets here sit at the short end; a larger room needs the long end.",
  turnkey:
    "Turn-key: the client says when and where. Be Legendary produces every detail, including shipping.",
  nonprofit:
    "Benefits a vetted local nonprofit matched to the experience and the client's market.",
  allInclusive: "All-inclusive: production, facilitation, materials and the donated goods.",
  connectionPoints:
    "Customized to the client's objectives through Connection Points woven into the build.",
};

/** The commercial and closing phases are identical across the give-backs. */
function commonTasks(opts: {
  /** Does a beneficiary group arrive on site? */
  beneficiariesOnSite: boolean;
  /** Label for the thing being built, lower case. */
  builtThing: string;
}): TaskRule[] {
  const t: TaskRule[] = [
    { phase: "1. Lock", title: "Signed agreement / SOW returned", offset: -30, role: "JC" },
    { phase: "1. Lock", title: "Deposit invoice sent", offset: -30, role: "JC" },
    { phase: "1. Lock", title: "W-9, COI + vendor onboarding submitted", offset: -25, role: "JC" },
    { phase: "1. Lock", title: "Deposit received", offset: -21, role: "JC" },
    { phase: "1. Lock", title: "Travel booked for facilitation team", offset: -21, role: "JC" },

    { phase: "2. Design", title: "Sponsor alignment call held (objectives + success measures)", offset: -25, role: "JC" },
    { phase: "2. Design", title: "Connection Points agreed with the sponsor", offset: -21, role: "JC",
      note: CATALOGUE.connectionPoints },
    { phase: "2. Design", title: "Participant count and team count confirmed", offset: -21, role: "JC" },
    { phase: "2. Design", title: "Nonprofit partner matched and agreed", offset: -25, role: "coordinator",
      note: CATALOGUE.nonprofit },
    { phase: "2. Design", title: "Attendee list + roles received", offset: -14, role: "JC" },
    { phase: "2. Design", title: "Content outline drafted", offset: -14, role: "JC" },
    { phase: "2. Design", title: "Content outline approved by sponsor", offset: -10, role: "JC" },

    { phase: "3. Produce", title: `${opts.builtThing} ordered and ship date confirmed`, offset: -21, role: "logistics",
      note: CATALOGUE.leadTimeNote },
    { phase: "3. Produce", title: "Run-of-show drafted", offset: -10, role: "JC" },
    { phase: "3. Produce", title: "AV + room requirements confirmed with venue", offset: -7, role: "logistics" },
    { phase: "3. Produce", title: "Run of show approved by sponsor", offset: -7, role: "JC" },
    { phase: "3. Produce", title: "Slides and media final", offset: -5, role: "JC" },
    { phase: "3. Produce", title: "Materials shipped; tracking number recorded", offset: -7, role: "logistics" },
    { phase: "3. Produce", title: "Materials arrival confirmed at venue", offset: -2, role: "logistics" },
    { phase: "3. Produce", title: "Final logistics email to sponsor", offset: -3, role: "JC" },

    { phase: "4. Deliver", title: "Delivery day", offset: 0, role: "all" },

    { phase: "5. Close", title: "Thank-you + recap email to sponsor", offset: 2, role: "JC" },
    { phase: "5. Close", title: "Participant feedback survey sent", offset: 2, role: "JC" },
    { phase: "5. Close", title: "Photographs delivered to client", offset: 3, role: "logistics" },
    { phase: "5. Close", title: "Final invoice sent", offset: 3, role: "JC" },
    { phase: "5. Close", title: "Contractor invoices received and reconciled", offset: 7, role: "JC" },
    { phase: "5. Close", title: "Event P&L closed", offset: 10, role: "JC" },
    { phase: "5. Close", title: "Debrief call with sponsor held", offset: 14, role: "JC" },
    { phase: "5. Close", title: "Final payment received", offset: 30, role: "JC" },
  ];

  if (opts.beneficiariesOnSite) {
    t.push(
      { phase: "2. Design", title: "Coordination letter sent to the nonprofit partner", offset: -21, role: "coordinator" },
      { phase: "2. Design", title: "Beneficiary count confirmed with the partner", offset: -18, role: "coordinator" },
      { phase: "3. Produce", title: "Beneficiary transport booked, confirmation number recorded", offset: -14, role: "logistics",
        condition: "beneficiary_travels" },
      { phase: "3. Produce", title: "Holding area confirmed, out of sight of the main room", offset: -7, role: "coordinator",
        note: "If the beneficiaries can be seen before the reveal, the moment the room turns on is lost." },
      { phase: "3. Produce", title: "Partner reconfirmed: arrival time, escorts, headcount", offset: -1, role: "coordinator" },
      { phase: "5. Close", title: "Thank-you to the nonprofit partner", offset: 2, role: "coordinator" },
    );
  }

  return t;
}

const COMMON_COSTS: CostLine[] = [
  { key: "materials", label: "Materials and donated goods", visibility: "contractor" },
  { key: "print", label: "Printed materials", visibility: "contractor" },
  { key: "freight", label: "Freight and shipping", visibility: "contractor" },
  { key: "venue_av", label: "Venue and AV charges", visibility: "contractor" },
  { key: "facilitation", label: "Facilitation crew", visibility: "contractor" },
  { key: "photography", label: "Photography", visibility: "contractor" },
  { key: "travel", label: "Facilitation team travel", visibility: "contractor" },
  { key: "contractor_fees", label: "Contractor fees", visibility: "contractor" },
  { key: "client_fee", label: "Client fee", visibility: "owner" },
  { key: "margin", label: "Gross margin", visibility: "owner",
    computed: "client_fee - sum(all contractor-visible lines)" },
];

const SENDER_PARAMS = [
  { key: "sender_name", label: "Letter signed by", type: "text" as const, default: "James Carter" },
  { key: "sender_title", label: "Signer title", type: "text" as const, default: "Founder and CEO, Be Legendary" },
  { key: "sender_phone", label: "Signer phone", type: "text" as const, default: "775-980-5703" },
  { key: "sender_email", label: "Signer email", type: "text" as const, default: "jcarter@repario.com" },
];

// ============================================================ Housewarming ==

const housewarming: Program = {
  code: "HW",
  name: "Housewarming",
  family: "charity-team-build",
  summary:
    "Sixty to ninety minutes. The room builds real homes for animals waiting to be adopted. When the group hits its goal, the animals arrive.",
  source:
    "Modeled from the Be Legendary Experience Information 2026 catalogue, which gives the description, the 60-90 minute band and the shared turn-key terms. Durations, quantities and ratios below are inferred from the proven give-back spine and are marked as such.",
  parameters: [
    { key: "participants", label: "Participants", type: "int", required: true },
    { key: "teams", label: "Teams", type: "int", required: true,
      help: "One animal home per team is the assumption. Confirm." },
    { key: "beneficiaries", label: "Animals arriving", type: "int", required: true },
    { key: "beneficiary_org", label: "Shelter or rescue partner", type: "text", required: true },
    { key: "beneficiary_contact_name", label: "Partner contact, first name", type: "text" },
    { key: "handlers", label: "Animal handlers accompanying", type: "int", default: 0,
      help: "The partner's own staff. They stay with the animals throughout. Defaulted so the handler ratio still computes before the partner has told us." },
    { key: "beneficiary_minors", label: "Beneficiaries are minors", type: "bool", default: false,
      help: "False for animals. Kept so the shared custody language stays off the letter." },
    { key: "beneficiary_travels", label: "Animals travel to the venue", type: "bool", default: true },
    { key: "homes_go_to_shelter", label: "Homes delivered to the shelter afterwards", type: "bool", default: true,
      help: "Animals rarely leave with their home on the day." },
    { key: "floor_protection", label: "Floor protection confirmed", type: "bool", default: false,
      help: "Venues almost always require it before live animals come indoors." },
    { key: "event_start", label: "Participant arrival time", type: "time", required: true },
    { key: "session_minutes", label: "Session length (minutes)", type: "int",
      help: "Typically 90 to 180 minutes; 120 is very typical. Leave blank to run at the "
        + "program's natural length of 97 minutes. Fixed steps such as the reveal keep "
        + "their length; the content block, the build and the debrief absorb the difference." },
    { key: "beneficiary_depart_by", label: "Hard deadline: animals must depart by", type: "time",
      help: "Animal welfare usually sets a firm limit. Set it and the schedule is placed backward from it." },
    { key: "client_descriptor", label: "How to describe the client to the partner", type: "text", default: "A company" },
    { key: "greeter_name", label: "Who meets the partner on arrival", type: "text" },
    { key: "holding_room", label: "Holding area", type: "text", default: "to be confirmed" },
    { key: "venue_phone", label: "Venue phone", type: "text" },
    ...SENDER_PARAMS,
  ],
  derived: {
    homes: "teams",
    animals_per_handler: "beneficiaries / max(1, handlers)",
  },
  quantities: [
    { item: "Animal home kits", formula: "teams + 1", basis: "one per team plus a spare", confidence: "medium",
      note: "One home per team is inferred from the bicycle build. Confirm whether homes are per team or per animal." },
    { item: "Build tables", formula: "teams", basis: "one per team", confidence: "medium" },
    { item: "Tool sets", formula: "teams", basis: "one per build table", confidence: "medium" },
    { item: "Team number stickers", formula: "teams", basis: "one per team", confidence: "high" },
    { item: "Client brief sheets", formula: "participants", basis: "one per participant", confidence: "medium" },
    { item: "Bedding and starter supplies", formula: "beneficiaries", basis: "one set per animal", confidence: "low",
      note: "Not stated in the catalogue. Confirm what travels with each animal." },
    { item: "Water bowls", formula: "max(2, ceil(beneficiaries / 4))", basis: "animals on site need water", confidence: "low" },
    { item: "Animals per handler", formula: "animals_per_handler", basis: "the partner sets its own ratio", confidence: "low",
      note: "Confirm the shelter's required handler ratio. It is a welfare limit, not a preference." },
  ],
  resources: [
    { key: "venue", label: "Venue", always: true,
      fields: ["name", "address", "contact_name", "contact_phone", "room", "animal_policy", "floor_protection", "av_notes"],
      note: "Live animals indoors need written venue permission and floor protection. Confirm both before anything else is booked." },
    { key: "shelter_partner", label: "Shelter or rescue partner", always: true,
      fields: ["org_name", "address", "contact_name", "contact_phone", "contact_email", "animal_count", "handler_count", "arrival_time", "welfare_limits"] },
    { key: "animal_transport", label: "Animal transport", condition: "beneficiary_travels",
      vehicle_rule: [
        { when: "beneficiaries <= 6", vehicle: "Partner's own vehicle", count_formula: "1" },
        { when: "beneficiaries > 6", vehicle: "Animal transport van", count_formula: "ceil(beneficiaries / 8)" },
      ],
      fields: ["vendor", "vendor_phone", "confirmation_number", "vehicle_type", "vehicle_count", "pickup_time", "cost"],
      note: "Usually the partner's own transport. Confirm who pays." },
    { key: "home_delivery", label: "Home delivery to the shelter", condition: "homes_go_to_shelter",
      fields: ["vendor", "depart_time", "arrive_time", "destination", "cost"] },
    { key: "photography", label: "Photography", always: true, fields: ["photographer", "contact", "cost"] },
  ],
  run_of_show: {
    anchor: "reveal",
    anchor_rule:
      "The animals arrive when the room hits its goal. If the partner sets a hard departure time, which animal welfare usually requires, the schedule is placed backward from it; otherwise it runs forward from arrival.",
    reveal_to_departure: 30,
    main_track: [
      { id: "setup", label: "Setup", duration: 75, before_start: true,
        details: ["Floor protection laid", "Build tables with one tool set each", "Theater seating for the open and close", "Audio and video check"] },
      { id: "arrival", label: "Participants arrive and are seated", duration: 10, fixed: true,
        details: ["Teams pre-assigned and mixed across departments"] },
      { id: "opening", label: "Opening remarks: client executive", duration: 5, fixed: true },
      { id: "content", label: "Be Legendary content block", duration: 15, min: 10,
        details: ["Connection Points woven in per the sponsor's objectives"] },
      { id: "build", label: "Build the animal homes", duration: 25, min: 15,
        details: ["One home per team", "Build instructions and client brief sheet issued", "No mention of the animals"] },
      { id: "reveal", label: "The Reveal: the group hits its goal and the animals arrive", duration: 5, fixed: true, is_anchor: true },
      { id: "present", label: "Teams meet the animals and present the homes", duration: 15, min: 10,
        details: ["Handlers stay with the animals throughout", "Roaming photography"] },
      { id: "photo", label: "Group photograph", duration: 5, fixed: true },
      { id: "reset", label: "Room reset for the debrief", duration: 3, fixed: true },
      { id: "debrief", label: "Debrief, facilitated", duration: 10, min: 5,
        details: ["What happened, so what, now what"] },
      { id: "close", label: "Close: client executive", duration: 4, fixed: true },
      { id: "loadout", label: "Homes loaded for delivery to the shelter", duration: 45, after_close: true },
    ],
    beneficiary_track: [
      { id: "confirm", label: "Partner confirms animals, handlers and welfare limits", offset_from_reveal: -1440 },
      { id: "depart_origin", label: "Animals depart the shelter", offset_from_reveal: -60 },
      { id: "arrive_venue", label: "Animals arrive and go to the holding area, out of sight of the room", offset_from_reveal: -30 },
      { id: "holding", label: "Handlers settle the animals; water and quiet", offset_from_reveal: -30, duration: 25 },
      { id: "enter", label: "Animals enter with their handlers", offset_from_reveal: 0 },
      { id: "return", label: "Animals returned to their handlers", offset_from_reveal: 25 },
      { id: "depart_venue", label: "Animals depart the venue", offset_from_reveal: 30 },
    ],
  },
  tasks: [
    ...commonTasks({ beneficiariesOnSite: true, builtThing: "Animal home kits" }),
    { phase: "2. Design", title: "Animal count, species and sizes confirmed", offset: -18, role: "coordinator",
      note: "Species and size change the home design. Confirm before kits are ordered." },
    { phase: "2. Design", title: "Shelter welfare limits agreed: time on site, noise, handling", offset: -18, role: "coordinator",
      note: "These are welfare limits, not preferences. They set the hard departure time." },
    { phase: "3. Produce", title: "Written venue permission for live animals indoors", offset: -21, role: "logistics",
      note: "Get this before anything else is booked. A venue refusal this late has no workaround." },
    { phase: "3. Produce", title: "Floor protection confirmed and sourced", offset: -14, role: "logistics",
      condition: "not floor_protection" },
    { phase: "3. Produce", title: "Water bowls and bedding staged in the holding area", offset: -1, role: "logistics" },
    { phase: "4. Deliver", title: "Homes delivered to the shelter", offset: 0, role: "logistics",
      condition: "homes_go_to_shelter" },
    { phase: "5. Close", title: "Adoption follow-up: did the animals find homes?", offset: 30, role: "coordinator",
      note: "The story the client will retell. Nobody finds out unless someone asks." },
  ],
  cost_lines: [
    ...COMMON_COSTS.slice(0, 1),
    { key: "animal_transport", label: "Animal transport", visibility: "contractor" },
    { key: "floor_protection", label: "Floor protection", visibility: "contractor" },
    { key: "home_delivery", label: "Home delivery to the shelter", visibility: "contractor" },
    ...COMMON_COSTS.slice(1),
  ],
};

// ============================================================ Get On Board ==

const getOnBoard: Program = {
  code: "GOB",
  name: "Get On Board",
  family: "charity-team-build",
  summary:
    "Two hours on change. Teams assemble skateboards from a bag of parts with no instructions, a hands-on lesson in embracing change, then gift the boards to local kids.",
  source:
    "Modeled from the Be Legendary Experience Information 2026 catalogue: the description, the two-hour duration and the change theme. Durations, quantities and ratios below are inferred from the proven give-back spine and are marked as such.",
  parameters: [
    { key: "participants", label: "Participants", type: "int", required: true },
    { key: "teams", label: "Teams", type: "int", required: true },
    { key: "beneficiaries", label: "Children receiving boards", type: "int", required: true },
    { key: "beneficiary_org", label: "Youth organization partner", type: "text", required: true },
    { key: "beneficiary_contact_name", label: "Partner contact, first name", type: "text" },
    { key: "age_min", label: "Youngest child age", type: "int", default: 8 },
    { key: "age_max", label: "Oldest child age", type: "int", default: 14 },
    { key: "beneficiary_minors", label: "Beneficiaries are minors", type: "bool", default: true },
    { key: "beneficiary_travels", label: "Children travel to the venue", type: "bool", default: true },
    { key: "boards_go_home_same_day", label: "Children take the boards home on the day", type: "bool", default: true },
    { key: "safety_gear", label: "Helmets and pads included", type: "bool", default: true,
      help: "A skateboard without a helmet is a liability conversation. Default is yes." },
    { key: "event_start", label: "Participant arrival time", type: "time", required: true },
    { key: "session_minutes", label: "Session length (minutes)", type: "int",
      help: "Typically 90 to 180 minutes; 120 is very typical. Leave blank to run at the "
        + "program's natural length of 125 minutes. Fixed steps such as the reveal keep "
        + "their length; the content block, the build and the debrief absorb the difference." },
    { key: "beneficiary_depart_by", label: "Hard deadline: children must depart by", type: "time" },
    { key: "client_descriptor", label: "How to describe the client to the partner", type: "text", default: "A company" },
    { key: "beneficiary_transport_by", label: "Who provides child transport", type: "text", default: "the partner organization" },
    { key: "greeter_name", label: "Who meets the children on arrival", type: "text" },
    { key: "holding_room", label: "Holding area", type: "text", default: "to be confirmed" },
    { key: "venue_phone", label: "Venue phone", type: "text" },
    ...SENDER_PARAMS,
  ],
  derived: {
    boards: "beneficiaries + 2",
  },
  quantities: [
    { item: "Skateboards (parts bags)", formula: "boards", basis: "one per child plus two spares", confidence: "medium",
      note: "Spares follow the bicycle build's pattern. Confirm." },
    { item: "Helmets", formula: "beneficiaries", basis: "one per child", confidence: "high" },
    { item: "Pad sets", formula: "beneficiaries", basis: "one per child", confidence: "medium" },
    { item: "Build tables", formula: "teams", basis: "one per team", confidence: "medium" },
    { item: "Tool sets", formula: "teams", basis: "one per build table", confidence: "medium",
      note: "Skate tools specifically. Confirm what a parts bag assumes is on the table." },
    { item: "Team number stickers", formula: "teams", basis: "one per team", confidence: "high" },
    { item: "Client brief sheets", formula: "participants", basis: "one per participant", confidence: "medium" },
    { item: "On-site technicians", formula: "max(1, ceil(boards / 30))", basis: "inspection before a child rides", confidence: "low",
      note: "Ratio copied from the bicycle build. A board assembled wrong is a safety issue, so confirm this one." },
  ],
  resources: [
    { key: "venue", label: "Venue", always: true,
      fields: ["name", "address", "contact_name", "contact_phone", "room", "floor_notes", "av_notes"],
      note: "Children may want to try the boards. Confirm whether riding indoors is permitted and where." },
    { key: "youth_partner", label: "Youth organization partner", always: true,
      fields: ["org_name", "address", "contact_name", "contact_phone", "contact_email", "child_count", "chaperone_count", "consent_status", "arrival_time"] },
    { key: "child_transport", label: "Child transport", condition: "beneficiary_travels",
      vehicle_rule: [
        { when: "beneficiaries <= 8", vehicle: "Van or car pool", count_formula: "1" },
        { when: "beneficiaries <= 20", vehicle: "Minibus or van", count_formula: "ceil(beneficiaries / 14)" },
        { when: "beneficiaries > 20", vehicle: "School or charter bus", count_formula: "ceil(beneficiaries / 40)" },
      ],
      fields: ["vendor", "vendor_phone", "confirmation_number", "vehicle_type", "vehicle_count", "pickup_time", "cost"] },
    { key: "technicians", label: "On-site technicians", always: true,
      count_formula: "max(1, ceil(boards / 30))",
      fields: ["names", "arrival_time", "location", "contact", "day_rate", "cost"],
      note: "Every board is inspected before it leaves. Trucks and hardware torque are the usual faults." },
    { key: "photography", label: "Photography", always: true, fields: ["photographer", "contact", "cost"] },
  ],
  run_of_show: {
    anchor: "reveal",
    anchor_rule:
      "The children are revealed as the recipients after the build. If the engagement has a hard departure deadline, the schedule is placed backward from it; otherwise it runs forward from arrival.",
    reveal_to_departure: 40,
    main_track: [
      { id: "setup", label: "Setup", duration: 90, before_start: true,
        details: ["Parts bags staged unopened", "Build tables with one skate tool set each", "Theater seating for the open and close", "Audio and video check"] },
      { id: "arrival", label: "Participants arrive and are seated", duration: 15, fixed: true },
      { id: "opening", label: "Opening remarks: client executive", duration: 5, fixed: true },
      { id: "content", label: "Be Legendary content block: change", duration: 25, min: 12,
        details: ["The parts bag arrives with no instructions on purpose", "Connection Points woven in per the sponsor's objectives"] },
      { id: "build", label: "Assemble the skateboards", duration: 30, min: 18,
        details: ["A bag of parts, no instructions", "Teams work out the sequence themselves", "No mention of the children"] },
      { id: "reveal", label: "The Reveal: the children enter", duration: 5, fixed: true, is_anchor: true },
      { id: "present", label: "Teams present the boards, fit helmets, ride with the children", duration: 20, min: 10,
        details: ["Roaming photography throughout"] },
      { id: "photo", label: "Group photograph", duration: 5, fixed: true },
      { id: "tunnel", label: "Human tunnel", duration: 3, fixed: true },
      { id: "reset", label: "Room reset for the debrief", duration: 3, fixed: true },
      { id: "debrief", label: "Debrief: what changed and when you noticed", duration: 10, min: 5 },
      { id: "close", label: "Close: client executive", duration: 4, fixed: true },
      { id: "inspection", label: "Technician inspection of every board", duration: 45, after_close: true },
    ],
    beneficiary_track: [
      { id: "confirm", label: "Partner confirms departure, chaperones and consent", offset_from_reveal: -1440 },
      { id: "depart_origin", label: "Children depart the partner organization", offset_from_reveal: -75 },
      { id: "arrive_venue", label: "Children arrive and go to the holding area, out of sight of the room", offset_from_reveal: -45 },
      { id: "holding", label: "Chaperones and support staff run the holding area", offset_from_reveal: -45, duration: 30 },
      { id: "sizing", label: "Helmet and pad fitting", offset_from_reveal: -15 },
      { id: "send_rep", label: "One participant from each team sent to meet their child", offset_from_reveal: -15 },
      { id: "enter", label: "Children enter with their team representative", offset_from_reveal: 0 },
      { id: "gear", label: "Helmets and pads presented with the boards", offset_from_reveal: 10 },
      { id: "return", label: "Children returned to their chaperones", offset_from_reveal: 38 },
      { id: "depart_venue", label: "Children depart the venue", offset_from_reveal: 40 },
    ],
  },
  tasks: [
    ...commonTasks({ beneficiariesOnSite: true, builtThing: "Skateboard parts bags" }),
    { phase: "2. Design", title: "Chaperone count and parental consent confirmed", offset: -14, role: "coordinator",
      condition: "beneficiary_minors" },
    { phase: "2. Design", title: "Child first names and ages received", offset: -14, role: "coordinator",
      note: "Ages drive board and helmet sizing." },
    { phase: "3. Produce", title: "Helmets and pads ordered", offset: -21, role: "logistics", condition: "safety_gear" },
    { phase: "3. Produce", title: "On-site technicians booked and day rate agreed", offset: -14, role: "logistics" },
    { phase: "3. Produce", title: "Confirm whether riding indoors is permitted, and where", offset: -14, role: "logistics",
      note: "The children will want to try them. Decide before the day, not during it." },
    { phase: "4. Deliver", title: "Board inspection complete before any child rides", offset: 0, role: "technician",
      note: "Loose trucks and untorqued hardware are the usual faults." },
  ],
  cost_lines: [
    ...COMMON_COSTS.slice(0, 1),
    { key: "safety_gear", label: "Helmets and pads", visibility: "contractor" },
    { key: "child_transport", label: "Child transport", visibility: "contractor" },
    { key: "technicians", label: "On-site technicians", visibility: "contractor" },
    ...COMMON_COSTS.slice(1),
  ],
};

// ==================================================== 60 Seconds to Give ==

const sixtySeconds: Program = {
  code: "60S",
  name: "60 Seconds to Give",
  family: "give-back-game-show",
  summary:
    "A high-energy give-back game show for 25 to 500 people. Teams race sixty-second challenges, and every win triggers a real donation to causes the client chooses.",
  source:
    "Modeled from the Be Legendary Experience Information 2026 catalogue: the description and the 25-500 headcount band. No beneficiary group arrives on site, so this program has no reveal. Durations and quantities below are inferred and marked as such.",
  parameters: [
    { key: "participants", label: "Participants", type: "int", required: true,
      help: "The catalogue band is 25 to 500." },
    { key: "teams", label: "Teams", type: "int", required: true },
    { key: "beneficiaries", label: "Beneficiaries on site", type: "int", default: 0,
      help: "Zero. Nobody arrives; the donation goes to the causes the client picks." },
    { key: "causes", label: "Number of causes", type: "int", default: 3,
      help: "The client chooses them. Each needs a named recipient before the day." },
    { key: "rounds", label: "Challenge rounds", type: "int", default: 8 },
    { key: "donation_per_win", label: "Donation per win (USD)", type: "number", default: 0,
      help: "Drives the donation ceiling the sponsor is committing to. Zero until the scoring rule is agreed in writing." },
    { key: "beneficiary_org", label: "Primary cause", type: "text", required: true },
    { key: "stage_led", label: "Stage-led with a host on mic", type: "bool", default: true },
    { key: "event_start", label: "Participant arrival time", type: "time", required: true },
    { key: "session_minutes", label: "Session length (minutes)", type: "int",
      help: "Typically 90 to 180 minutes; 120 is very typical. Leave blank to run at the "
        + "program's natural length of 105 minutes. Fixed steps such as the reveal keep "
        + "their length; the content block, the build and the debrief absorb the difference." },
    { key: "client_descriptor", label: "How to describe the client", type: "text", default: "A company" },
    { key: "venue_phone", label: "Venue phone", type: "text" },
    ...SENDER_PARAMS,
  ],
  derived: {
    max_donation: "rounds * max(1, causes) * donation_per_win",
  },
  quantities: [
    { item: "Team challenge kits", formula: "teams", basis: "one per team", confidence: "medium" },
    { item: "Challenge sets", formula: "rounds", basis: "one per round", confidence: "medium" },
    { item: "Scoreboards", formula: "max(1, ceil(teams / 12))", basis: "one per zone", confidence: "low",
      note: "Not stated. Confirm how scoring is displayed at the top of the headcount band." },
    { item: "Client brief sheets", formula: "participants", basis: "one per participant", confidence: "medium" },
    { item: "Hosts on mic", formula: "1", basis: "one host", confidence: "medium" },
    { item: "Facilitators", formula: "max(1, ceil(teams / 8))", basis: "roaming, one per eight teams", confidence: "low",
      note: "Inferred from the Inspiring Minds staffing pattern. Confirm." },
    { item: "Donation ceiling (USD)", formula: "max_donation", basis: "rounds x causes x donation per win", confidence: "low",
      note: "This is the number the sponsor is committing to. Confirm the scoring rule before quoting it." },
  ],
  resources: [
    { key: "venue", label: "Venue", always: true,
      fields: ["name", "address", "contact_name", "contact_phone", "room", "stage_notes", "av_notes"] },
    { key: "av_and_staging", label: "AV and staging", always: true,
      fields: ["vendor", "contact", "mic_type", "countdown_clock", "scoreboard", "stage_notes", "cost"],
      note: "A sixty-second format lives or dies on a visible clock and audible cues." },
    { key: "causes", label: "Causes and recipients", always: true,
      fields: ["cause_names", "recipient_contacts", "donation_mechanism", "confirmation"],
      note: "Every cause needs a named recipient and an agreed mechanism before the day, or the donation is a promise rather than a transfer." },
    { key: "photography", label: "Photography", always: true, fields: ["photographer", "contact", "cost"] },
  ],
  run_of_show: {
    anchor: "totals",
    anchor_rule:
      "This program has no beneficiary reveal, because nobody arrives. The anchor is the moment the totals are read out, and the schedule always runs forward from participant arrival.",
    main_track: [
      { id: "setup", label: "Setup", duration: 90, before_start: true,
        details: ["Team tables and challenge kits staged", "Stage, mic, countdown clock and scoreboard tested"] },
      { id: "arrival", label: "Participants arrive and are seated", duration: 15, fixed: true,
        details: ["Teams pre-assigned"] },
      { id: "opening", label: "Opening remarks: client executive", duration: 5, fixed: true },
      { id: "brief", label: "Host sets the format and the stakes", duration: 10, fixed: true,
        details: ["Every win triggers a real donation", "The causes are named up front"] },
      { id: "rounds", label: "Sixty-second challenge rounds", duration: 55, min: 20,
        details: ["Teams race the clock", "Running donation total on the scoreboard"] },
      { id: "totals", label: "The totals are read out", duration: 10, fixed: true, is_anchor: true,
        details: ["What the room raised, by cause"] },
      { id: "debrief", label: "Debrief and close: client executive", duration: 10, min: 5 },
      { id: "loadout", label: "Load-out", duration: 45, after_close: true },
    ],
    beneficiary_track: [],
  },
  tasks: [
    ...commonTasks({ beneficiariesOnSite: false, builtThing: "Team challenge kits" }),
    { phase: "2. Design", title: "Causes chosen by the client and recipients named", offset: -21, role: "JC",
      note: "A cause without a named recipient and an agreed transfer mechanism is a promise, not a donation." },
    { phase: "2. Design", title: "Scoring rule and donation per win agreed in writing", offset: -21, role: "JC",
      note: "This sets the ceiling the sponsor is committing to. Agree it before quoting." },
    { phase: "3. Produce", title: "Host briefed and script rehearsed", offset: -5, role: "JC", condition: "stage_led" },
    { phase: "3. Produce", title: "Countdown clock and scoreboard tested on site", offset: -1, role: "logistics",
      note: "A sixty-second format with an unreliable clock has no format." },
    { phase: "5. Close", title: "Donations transferred and receipts obtained", offset: 7, role: "JC",
      note: "The commitment made on stage. Nothing else in this program matters if this slips." },
    { phase: "5. Close", title: "Donation confirmation sent to the sponsor", offset: 10, role: "JC" },
  ],
  cost_lines: [
    ...COMMON_COSTS.slice(0, 1),
    { key: "donations", label: "Donations triggered", visibility: "contractor" },
    { key: "av_staging", label: "AV, stage, clock and scoreboard", visibility: "contractor" },
    { key: "host", label: "Host", visibility: "contractor" },
    ...COMMON_COSTS.slice(1),
  ],
};

for (const p of [housewarming, getOnBoard, sixtySeconds]) {
  const file = join(OUT, `${p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.json`);
  writeFileSync(file, `${JSON.stringify(p, null, 2)}\n`);
  console.log(
    `${p.code.padEnd(4)} ${p.name.padEnd(22)} params ${String(p.parameters.length).padStart(2)} · ` +
      `quantities ${String(p.quantities.length).padStart(2)} · resources ${p.resources.length} · ` +
      `tasks ${p.tasks.length} · ${file.split("/").pop()}`,
  );
}
