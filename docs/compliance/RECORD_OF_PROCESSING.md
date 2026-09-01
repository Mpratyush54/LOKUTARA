# Record of processing activities

Last reviewed: 2026-08-31

## Public enquiries

Name, email, phone, role, organisation, size, and preferred time are used to
reply to the requested discovery or counselling contact. Access is limited to
authorised Lokutara staff and communication processors. The notice
acknowledgement is recorded; Mongo records expire after 12 months unless the
enquiry becomes a service relationship.

## Account

Name, email, phone, adult age, city, organisation, password hash, plan, and
notice acceptance support authentication, workspace delivery, support, access,
and billing. Authorised support/admin personnel and hosting/database processors
receive only what their role needs. Users can correct, export, and
password-confirm deletion; sessions expire after 30 days.

## Assessment

Answers, score, report, assessment/version, and consent time deliver the
participant-requested developmental screen. Recipients are the participant and
restricted hosting/database processors. Answers do not enter analytics; general
admin feeds withhold participant name and score; export and deletion are
available.

## Community

Display name, question/reply, tags, and votes operate member discussion for
authorised members, moderators, and hosting/database processors. Posting
requires a privacy warning and acknowledgement. Authorship is anonymised on
account deletion.

## Checkout and invoice

Name, email, phone, organisation, SKU, amount, GST, status, and payment
references support payment, fulfilment, accounting, and tax. Razorpay,
authorised billing staff, and hosting/database processors receive relevant
data. Full card/UPI credentials are not stored here; statutory records are
restricted after account deletion. Admin-granted complimentary access is
stored as a ₹0 complimentary record labelled “Given by Admin”. Those records
are not Razorpay payments, not GST tax invoices, and are excluded from
revenue and outstanding totals.

## Optional analytics

Visitor/session IDs, path, referral/campaign, device/browser/OS, coarse
location, and allow-listed event properties support product and campaign
measurement. Analytics remains off before consent, offers purpose choices, and
uses a 13-month Mongo TTL.

## Security

Session token, timestamps, IP-related operational data, and relevant ICT logs
support authentication, abuse prevention, incident detection, and legal
compliance. Access is limited to operators, security processors, and CERT-In
when legally required. Cookies are secure in production, mutations are
same-origin checked, and endpoints are rate-limited. India log location remains
an operational launch requirement; relevant logs require at least 180 days.

## Prohibited flows

- Counselling/session content, diagnoses, symptoms, health details, assessment
  answers, and community bodies must not enter analytics event properties.
- Employers must not receive individual counselling content.
- General administrators must not receive participant names or scores in
  assessment activity feeds.
- Community and general lead forms must not be presented as confidential
  clinical channels.
- Full payment credentials must not be stored by Lokutara.

## Review trigger

Update this file and the notices before adding a field, vendor, AI model,
automated decision, published assessment, child user, new geography, employer
report, clinical workflow, or new retention period.
