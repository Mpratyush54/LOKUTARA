export const LEGAL_VERSION = "2026-08-31";
export const PRIVACY_EMAIL =
  process.env.NEXT_PUBLIC_PRIVACY_EMAIL || "privacy@lokutara.in";
export const GRIEVANCE_EMAIL =
  process.env.NEXT_PUBLIC_GRIEVANCE_EMAIL || PRIVACY_EMAIL;

export type ComplianceItem = {
  id: string;
  name: string;
  status: "in-force" | "transition" | "scope-review" | "professional";
  applies: string;
  controls: string[];
  source: string;
};

export const COMPLIANCE_REGISTER: ComplianceItem[] = [
  {
    id: "dpdp",
    name: "Digital Personal Data Protection Act, 2023 and DPDP Rules, 2025",
    status: "transition",
    applies:
      "Digital personal data about visitors, leads, account holders, assessment participants, community members, and payers. The 2025 Rules have staggered commencement dates.",
    controls: [
      "Plain-language, purpose-specific notices before collection",
      "Consent records, withdrawal path, and adult-only service",
      "Access, correction, erasure, grievance, and nomination readiness",
      "Processor contracts, security safeguards, breach response, and erasure schedule",
    ],
    source:
      "https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf",
  },
  {
    id: "it-spdi",
    name: "Information Technology Act, 2000 and SPDI Rules, 2011",
    status: "in-force",
    applies:
      "Account, password, assessment, counselling-interest, payment, and other personal or potentially sensitive records handled by a body corporate.",
    controls: [
      "Published privacy policy and consent for stated purposes",
      "Reasonable security practices and restricted access",
      "Correction, review, withdrawal, grievance contact, and controlled disclosure",
      "Written safeguards for processors and vendors",
    ],
    source: "https://www.meity.gov.in/content/rules",
  },
  {
    id: "cert-in",
    name: "CERT-In Directions under section 70B of the IT Act, 2022",
    status: "in-force",
    applies:
      "Cybersecurity operations, system clocks, qualifying incident reporting, and ICT logs.",
    controls: [
      "Named incident-response contact and documented escalation",
      "Report qualifying incidents to CERT-In within six hours of noticing",
      "Maintain relevant ICT logs securely in India for a rolling 180 days",
      "Preserve evidence without putting assessment or counselling content in general logs",
    ],
    source:
      "https://www.cert-in.org.in/PDF/CERT-In_Directions_70B_28.04.2022.pdf",
  },
  {
    id: "consumer",
    name: "Consumer Protection Act, 2019 and Consumer Protection (E-Commerce) Rules, 2020",
    status: "in-force",
    applies:
      "Descriptions, prices, GST, checkout, refunds, complaints, and claims made to individual buyers.",
    controls: [
      "Accurate service descriptions and full payable price before checkout",
      "No dark patterns, fake urgency, or misleading outcome claims",
      "Terms for cancellation, rescheduling, refunds, delivery, and complaints",
      "Seller and grievance-contact information",
    ],
    source: "https://consumeraffairs.nic.in/acts-and-rules/consumer-protection",
  },
  {
    id: "mental-healthcare",
    name: "Mental Healthcare Act, 2017",
    status: "in-force",
    applies:
      "Mental-healthcare services and records where Lokutara or its professionals provide care or treatment.",
    controls: [
      "Confidentiality for mental-health and treatment information, including digital records",
      "Access to records and a complaints path",
      "No employer access to individual counselling content",
      "Crisis, emergency, capacity, and permitted-disclosure procedures",
    ],
    source: "https://www.indiacode.nic.in/handle/123456789/2249",
  },
  {
    id: "rci",
    name: "Rehabilitation Council of India Act, 1992",
    status: "in-force",
    applies:
      "Use of the title and functions of clinical or rehabilitation psychologists.",
    controls: [
      "Verify active Central Rehabilitation Register status before listing a clinical psychologist",
      "Display truthful credentials and registration details",
      "Do not represent non-registered personnel as clinical psychologists",
      "Keep role-based access and professional accountability records",
    ],
    source: "https://rehabcouncil.nic.in/norms-guidelines/",
  },
  {
    id: "mental-establishment",
    name: "Mental-health-establishment registration requirements",
    status: "scope-review",
    applies:
      "May apply depending on whether Lokutara itself is a mental health establishment and how counselling is contracted and delivered in Karnataka.",
    controls: [
      "Obtain Karnataka counsel's written scope determination before clinical launch",
      "Confirm establishment and practitioner registrations",
      "Document referral, emergency, record-access, and nominated-representative processes",
    ],
    source: "https://www.indiacode.nic.in/handle/123456789/2249",
  },
  {
    id: "intermediary",
    name: "Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021",
    status: "scope-review",
    applies:
      "May apply to the member community because Lokutara stores and displays user-generated questions and replies.",
    controls: [
      "Community rules, complaint intake, moderation, and takedown workflow",
      "Preserve content only when lawfully required",
      "Publish a grievance contact and response workflow",
      "Obtain counsel's intermediary classification and diligence review",
    ],
    source: "https://www.meity.gov.in/content/intermediary-guidelines-and-digital-media-ethics-code-rules-2021",
  },
  {
    id: "rpd",
    name: "Rights of Persons with Disabilities Act, 2016",
    status: "scope-review",
    applies:
      "Non-discrimination, reasonable accommodation, and accessibility in assessments, training, and employment-related use.",
    controls: [
      "Accessible keyboard and screen-reader interactions",
      "Accommodation and alternative-format request path",
      "Do not use assessment results to discriminate",
      "Human review before any consequential workplace use",
    ],
    source: "https://www.indiacode.nic.in/handle/123456789/2155",
  },
  {
    id: "posh",
    name: "Sexual Harassment of Women at Workplace Act, 2013",
    status: "scope-review",
    applies:
      "Lokutara as an employer and any workplace programme that receives harassment disclosures. This product is not an Internal Committee complaint channel.",
    controls: [
      "Route disclosures to the employer's lawful POSH process when authorised",
      "Do not invite case details into analytics, community, or general lead forms",
      "Maintain strict need-to-know confidentiality",
      "Confirm Lokutara's own Internal Committee obligations with HR counsel",
    ],
    source: "https://www.indiacode.nic.in/handle/123456789/2104",
  },
  {
    id: "gst",
    name: "Central and State GST laws and invoice rules",
    status: "in-force",
    applies: "Tax display, payment records, invoices, credit notes, and statutory retention.",
    controls: [
      "Show the GST-inclusive payable amount before Razorpay",
      "Issue sequential invoices with supplier and tax details",
      "Label admin-granted ₹0 records as complimentary, not GST tax invoices, and exclude them from revenue",
      "Retain tax records for the applicable statutory period",
      "Do not erase records that must be retained by law; restrict and archive them instead",
    ],
    source: "https://www.gst.gov.in/",
  },
  {
    id: "payments",
    name: "Payment and Settlement Systems Act / RBI payment-aggregator framework",
    status: "scope-review",
    applies:
      "Razorpay checkout, merchant onboarding, payment references, refunds, webhook integrity, and customer support.",
    controls: [
      "Use an authorised payment provider and complete merchant KYC",
      "Do not store full card, UPI credential, PIN, CVV, or other authentication data",
      "Verify webhook signatures and reconcile payment status before fulfilment",
      "Publish delivery, cancellation, refund, and grievance terms before payment",
    ],
    source:
      "https://www.rbi.org.in/Scripts/NotificationUser.aspx?Id=11822&Mode=0",
  },
  {
    id: "remote-care",
    name: "Remote mental-health and telemedicine scope",
    status: "scope-review",
    applies:
      "Video, phone, or chat-based counselling. The Telemedicine Practice Guidelines directly regulate registered medical practitioners; psychologist/counsellor scope requires a separate professional and Karnataka review.",
    controls: [
      "Confirm practitioner identity, location, scope, consent, privacy, and emergency plan",
      "Do not imply that a general enquiry or community post begins clinical care",
      "Use a separate clinical record and informed-consent process",
      "Obtain counsel's written telepractice and establishment determination before launch",
    ],
    source:
      "https://www.mohfw.gov.in/pdf/Telemedicine.pdf",
  },
  {
    id: "psychometrics",
    name: "Responsible testing standards (ITC Guidelines and ISO 10667)",
    status: "professional",
    applies:
      "Assessment design, administration, interpretation, reporting, accessibility, and workplace decisions. These are safeguards, not a claim that every standard is a statute.",
    controls: [
      "State purpose, evidence base, limitations, intended population, and accommodations",
      "Label unvalidated screens accurately; do not call them licensed or diagnostic tests",
      "Qualified human interpretation for consequential use",
      "Never make hiring, firing, promotion, diagnosis, or treatment decisions solely from a score",
    ],
    source: "https://www.intestcom.org/page/16",
  },
];

export const RETENTION_SCHEDULE = [
  {
    record: "Unsaved assessment draft in this browser",
    period: "Until submission, sign-out/clear-site-data, or manual reset",
  },
  {
    record: "Assessment answers and reports",
    period:
      "While the account is active, then erased on a valid request unless a dispute or law requires a restricted copy",
  },
  {
    record: "Discovery and counselling-interest leads",
    period: "12 months after the last meaningful contact, unless a service relationship or legal hold applies",
  },
  {
    record: "Community content",
    period:
      "While useful to the member community; anonymised or erased after a valid request unless preservation is legally required",
  },
  {
    record: "Invoices, tax, and payment records",
    period: "For the statutory tax/accounting period; access is restricted after account deletion",
  },
  {
    record: "Security and ICT logs",
    period:
      "At least 180 days in India under the CERT-In Directions; longer only for security, legal hold, or another applicable law",
  },
  {
    record: "Optional analytics identifiers",
    period: "No longer than 13 months, and reset when optional consent is withdrawn where technically possible",
  },
] as const;

export const ASSESSMENT_NOTICE_VERSION = "assessment-2026-08-31";
export const ACCOUNT_NOTICE_VERSION = "account-2026-08-31";
