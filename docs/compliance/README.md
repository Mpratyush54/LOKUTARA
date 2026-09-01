# Lokutara compliance operating file

Last reviewed: 2026-08-31

This folder turns the public register in `lib/legal/compliance.ts` into an
operational process. It is not legal certification.

## Release gate

Every release that changes data, assessments, counselling, community, people
decisions, payments, analytics, vendors, or AI must record:

1. data fields, purpose, collection notice, and user expectation;
2. data controller/fiduciary and processor roles;
3. access roles, sharing recipients, storage region, and transfer path;
4. retention trigger, deletion behavior, export/correction path, and legal hold;
5. age, accessibility, safety, moderation, and human-review implications;
6. security controls, logs, incident signals, and abuse limits;
7. claims/evidence review and applicable commercial terms;
8. tests for consent bypass, cross-account access, erasure, and sensitive logs.

## Current launch blockers requiring an owner

- Confirm legal entity name, registered address, GSTIN, and invoice particulars.
- Make `privacy@lokutara.in` and its response workflow operational, or set
  `NEXT_PUBLIC_PRIVACY_EMAIL` and `NEXT_PUBLIC_GRIEVANCE_EMAIL`.
- Obtain a Karnataka legal opinion on mental-health-establishment scope,
  counselling delivery, and intermediary status for the community.
- Verify and record practitioner qualifications, active registrations, role,
  professional indemnity, supervision, and permitted scope.
- Approve a service-by-service cancellation, rescheduling, and refund schedule
  before accepting public payment.
- Complete processor agreements and the vendor register.
- Configure India-resident security-log storage for at least 180 days and test
  the CERT-In six-hour escalation.
- Commission an accessibility review and an independent application-security
  test before production.
- Validate any assessment before making predictive or suitability claims.

## Evidence to retain

- Notice versions and acceptance timestamps
- Data-flow and vendor reviews
- Access and deletion test results
- Practitioner verification and assessment evidence
- Incident exercises and security reviews
- Complaint, moderation, and rights-request records
- Invoice/tax configuration approval
