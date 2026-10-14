export const WAIVER_TITLE = "Waiver, Release of Liability & Facility Rules";

export const WAIVER_CONFIRMATION_TEXT =
  "I confirm that I have read and agreed to the Waiver and Release of Liability and Facility Rules of Grove District. I further confirm that all participants included in this booking have been informed of and agree to these terms and voluntarily assume all risks associated with participation.";

export const WAIVER_PREAMBLE =
  "By booking, entering, or using the facilities of Grove District, all players, guests, spectators, and participants acknowledge and agree to the following terms and conditions:";

export const WAIVER_SECTIONS: { num: number; title: string; text: string }[] = [
  {
    num: 1,
    title: "Assumption of Risk",
    text: "I understand that pickleball and related activities involve inherent risks, including but not limited to slips, falls, collisions, physical contact, equipment failure, overexertion, serious injury, permanent disability, or death. I voluntarily choose to participate despite these risks.",
  },
  {
    num: 2,
    title: "Release of Liability",
    text: "To the fullest extent permitted under Philippine law, I hereby release, waive, discharge, and hold harmless Grove District, its owners, management, employees, staff, coaches, agents, affiliates, and representatives from any and all claims, liabilities, damages, losses, costs, or expenses arising from or related to participation, use of the facilities, equipment, premises, or services, including injuries, accidents, property damage, or losses, whether caused by negligence or otherwise, except in cases of gross negligence or willful misconduct as provided by law.",
  },
  {
    num: 3,
    title: "Health and Fitness",
    text: "All participants confirm that they are physically fit and capable of participating in pickleball activities and voluntarily assume all risks associated with participation.",
  },
  {
    num: 4,
    title: "Responsibility for Personal Belongings",
    text: "Grove District shall not be responsible for lost, stolen, or damaged personal belongings brought onto the premises.",
  },
  {
    num: 5,
    title: "Facility Rules & Strict No-Cancellation Policy",
    text: "All participants agree to follow all facility rules, staff instructions, safety protocols, and court regulations at all times. Non-marking shoes are strictly required. All court bookings are final and non-refundable. Grove District reserves the right to refuse entry or remove any individual for unsafe, disruptive, abusive, or inappropriate behavior without refund.",
  },
  {
    num: 6,
    title: "Equipment and Premises",
    text: "Participants acknowledge that sports equipment and facilities may involve risks despite regular maintenance and inspections. Any unsafe condition, damaged equipment, spills, or hazards should immediately be reported to staff. Players must bring their own paddles.",
  },
  {
    num: 7,
    title: "Emergency Medical Treatment",
    text: "In the event of injury or medical emergency, participants authorize Grove District staff to obtain emergency medical assistance if necessary. Any medical costs incurred shall remain the sole responsibility of the participant.",
  },
  {
    num: 8,
    title: "Group Bookings and Representation",
    text: "The individual making the booking represents and warrants that they are authorized to make the reservation on behalf of all participants included in the booking. By completing a booking, the booking individual confirms that all participants in the group have been informed of and agree to the terms, conditions, rules, risks, and waiver provisions stated herein. All participants entering or using the facilities of Grove District shall be deemed to have accepted these terms and voluntarily assumed all risks associated with participation, regardless of whether they personally completed the booking. Grove District reserves the right to require any participant to individually complete and sign a waiver prior to participating in any activity.",
  },
  {
    num: 9,
    title: "Minors",
    text: "Participants below eighteen (18) years old must have consent from a parent or legal guardian. The parent or legal guardian accepts these terms on behalf of the minor participant.",
  },
  {
    num: 10,
    title: "Indemnification",
    text: "Participants agree to indemnify and hold harmless Grove District, its owners, staff, employees, and affiliates from any claims, demands, actions, damages, liabilities, costs, or expenses, including legal fees, arising from the participant’s actions, negligence, misconduct, violation of facility rules, or participation in activities within the premises.",
  },
  {
    num: 11,
    title: "Weather, Force Majeure, and Uncontrollable Events",
    text: "Grove District shall not be liable for interruptions, cancellations, injuries, damages, or losses caused by weather conditions, natural disasters, power outages, acts of God, emergencies, government actions, or other circumstances beyond reasonable control.",
  },
  {
    num: 12,
    title: "CCTV and Security Monitoring",
    text: "Participants acknowledge that portions of the facility may be monitored by CCTV cameras for safety, security, operational, and incident documentation purposes.",
  },
  {
    num: 13,
    title: "Photo and Video Consent",
    text: "Participants consent to the use of photographs, videos, or recordings taken within the facility for promotional, marketing, security, or operational purposes unless otherwise requested in writing.",
  },
  {
    num: 14,
    title: "Limitation of Liability",
    text: "To the maximum extent permitted by law, Grove District’s total liability for any claim related to facility use shall be limited to the amount paid for the applicable booking or service.",
  },
  {
    num: 15,
    title: "Severability",
    text: "If any provision of this waiver is found invalid or unenforceable, the remaining provisions shall continue in full force and effect.",
  },
  {
    num: 16,
    title: "Acknowledgment",
    text: "By proceeding with a booking, entering the premises, or participating in any activity, all participants acknowledge that they have carefully read, understood, and voluntarily agreed to this Waiver and Release of Liability.",
  },
];

export const DEFAULT_FULL_WAIVER_TEXT = WAIVER_SECTIONS.map(
  (s) => `${s.num}. ${s.title}\n${s.text}`
).join("\n\n");

export function parseWaiverSections(rawText?: string | null): { num: number; title: string; text: string }[] {
  if (!rawText || !rawText.trim()) return WAIVER_SECTIONS;

  // Try to split by numbered sections like "1. Title\nText"
  const sectionPattern = /(?:^|\n\n+)(\d+)\.\s*([^\n]+)\n+([\s\S]*?)(?=(?:\n\n+\d+\.|$))/g;
  const parsed: { num: number; title: string; text: string }[] = [];
  let match;
  while ((match = sectionPattern.exec(rawText)) !== null) {
    parsed.push({
      num: Number(match[1]),
      title: match[2].trim(),
      text: match[3].trim(),
    });
  }

  if (parsed.length > 0) return parsed;

  // If not formatted as numbered sections, split by double newline as paragraphs
  const paragraphs = rawText.split(/\n\n+/).filter((p) => p.trim().length > 0);
  return paragraphs.map((p, idx) => ({
    num: idx + 1,
    title: `Section ${idx + 1}`,
    text: p.trim(),
  }));
}
