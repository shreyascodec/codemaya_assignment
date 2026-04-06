'use strict';

require('dotenv').config();

const mongoose = require('mongoose');
const Document = require('./src/models/Document');

const documents = [
  {
    title: 'Billing & Payment Methods',
    tags: ['billing', 'payment', 'invoice', 'credit-card', 'bank-transfer'],
    content: `Your subscription is billed on a recurring cycle — monthly or annual depending on the plan you selected at signup. Invoices are generated automatically at the start of each billing period and sent to the billing email on file.

We accept Visa, Mastercard, American Express, and Discover for credit/debit card payments. ACH bank transfers are available for annual plans on the Growth tier and above. Invoices are due upon receipt; failed payments trigger an automatic retry at 3, 5, and 7 days before the subscription is paused.

To update your payment method, navigate to Settings → Billing → Payment Methods. Only workspace admins with the Billing Admin role can modify payment details. If you need to add a backup card, you can store up to three cards and designate a primary.

Invoices are available in PDF format under Settings → Billing → Invoice History. Paid invoices include a breakdown by seat, add-on, and applicable taxes. For enterprise contracts with custom billing terms, invoices are issued net-30 unless otherwise specified in your order form.`,
  },
  {
    title: 'Refund Policy',
    tags: ['refund', 'cancellation', 'billing', 'money-back', 'downgrade'],
    content: `We offer a 14-day money-back guarantee on new subscriptions. If you cancel within 14 days of your initial purchase and have not exceeded 1,000 API calls or 5 GB of data processed, you're eligible for a full refund with no questions asked. After 14 days, subscriptions are non-refundable except in cases of duplicate charges or billing errors on our end.

To request a refund, go to Settings → Billing → Request Refund or email billing@yourapp.com with your invoice number and reason. Refunds are processed within 5–7 business days and returned to the original payment method. For credit card refunds, it may take an additional 3–5 business days for the funds to appear depending on your bank.

Annual plan downgrades: if you downgrade from an annual plan mid-term, you'll receive a prorated credit applied to future invoices — no cash refunds for annual commitments beyond the 14-day window. Enterprise contracts follow the refund terms outlined in your MSA.`,
  },
  {
    title: 'Subscription Plans & Pricing',
    tags: ['plans', 'pricing', 'starter', 'growth', 'enterprise', 'seats', 'limits'],
    content: `We offer three subscription tiers designed to scale with your team.

**Starter** ($29/month): Up to 5 seats, 10,000 API calls/month, 5 GB storage, community support, and access to core integrations (Slack, email). No SSO or custom roles.

**Growth** ($99/month per 10 seats): Unlimited seats (billed in blocks of 10), 100,000 API calls/month, 50 GB storage, priority email support, all integrations, custom roles, audit logs, and SAML SSO. API call overages are billed at $0.008/call.

**Enterprise** (custom pricing): Unlimited everything, dedicated infrastructure option, SLA-backed uptime (99.9%), 24/7 phone support, custom data retention policies, self-hosted deployment option, and a named customer success manager. Minimum 12-month contract.

Annual billing saves 20% across all tiers. Seats can be added mid-cycle and are prorated to the next billing date. Unused seats cannot be removed mid-cycle but can be reduced at renewal. Free trials are available for Starter and Growth — no credit card required for 14 days.`,
  },
  {
    title: 'Onboarding Guide: Getting Started',
    tags: ['onboarding', 'setup', 'getting-started', 'workspace', 'team', 'invites'],
    content: `Welcome to the platform. This guide walks you through the first 30 minutes — from workspace creation to your first productive workflow.

**Step 1: Create your workspace.** After email verification, you'll be prompted to name your workspace. Choose something recognizable — this appears in URLs and email notifications. Workspace names can be changed later under Settings → General.

**Step 2: Invite your team.** Go to Settings → Members → Invite. Enter email addresses separated by commas. Invitees receive a link valid for 72 hours. Set their role at invite time: Admin (full access), Member (standard), or Viewer (read-only). Roles can be changed after acceptance.

**Step 3: Configure integrations.** Head to Settings → Integrations to connect Slack for notifications, GitHub for issue syncing, or your SSO provider. Most integrations activate immediately with OAuth — no engineering required.

**Step 4: Import existing data.** Use the CSV importer under Tools → Import to bring in historical records. For large imports (>10k rows), use the bulk API endpoint documented at /api/v1/import.

If you get stuck, use the in-app chat widget or visit docs.yourapp.com for step-by-step tutorials.`,
  },
  {
    title: 'Third-Party Integrations',
    tags: ['integrations', 'slack', 'github', 'zapier', 'salesforce', 'webhooks', 'oauth'],
    content: `The platform integrates natively with the tools your team already uses. All integrations use OAuth 2.0 and require admin-level approval in the connected app.

**Slack**: Receive real-time notifications for mentions, status changes, and alerts directly in your Slack channels. Configure notification rules under Settings → Integrations → Slack. You can map different event types to different channels. The Slack bot also supports slash commands for quick lookups without leaving Slack.

**GitHub**: Sync issues bidirectionally between your workspace and GitHub repositories. Closing an issue in either system closes it in the other. Supported on GitHub.com and GitHub Enterprise Server (v3.0+). Connect under Settings → Integrations → GitHub.

**Zapier**: The Zapier integration exposes all major events as triggers and supports common actions. Over 5,000 Zaps are available in the Zapier marketplace tagged with our platform name. Use this for connecting to tools we don't natively support.

**Salesforce**: Available on Growth and Enterprise plans. Syncs contact and deal data bidirectionally. Initial sync can take up to 2 hours for large Salesforce orgs. Field mapping is configurable via the integration settings page.

**Webhooks**: All plans support outgoing webhooks for custom integrations. Set a URL and select event types under Settings → Webhooks. We retry failed webhook deliveries up to 5 times with exponential backoff.`,
  },
  {
    title: 'API Rate Limits & Quotas',
    tags: ['api', 'rate-limits', 'quotas', 'throttling', '429', 'headers', 'pagination'],
    content: `Every API request is subject to both per-minute rate limits and monthly volume quotas. Rate limit headers are included in every response so you can monitor consumption without hitting the dashboard.

**Per-minute limits**: Starter: 60 requests/minute. Growth: 300 requests/minute. Enterprise: 1,000 requests/minute (configurable). Limits are applied per API key, not per user. If you exceed the per-minute limit, the API returns HTTP 429 with a Retry-After header indicating the seconds to wait.

**Monthly quotas**: Starter: 10,000 calls/month. Growth: 100,000 calls/month. Overages on Growth plans are automatically billed at $0.008/call at the end of the billing period. Starter plans have hard cutoffs — calls beyond 10,000 return 402 until the next cycle.

**Response headers**: Every response includes X-RateLimit-Limit, X-RateLimit-Remaining, and X-RateLimit-Reset (Unix timestamp). Monitor X-RateLimit-Remaining and back off before hitting zero rather than relying on 429 responses.

**Increasing limits**: Enterprise customers can request custom rate limit increases by contacting support with expected peak RPS and justification. Growth customers can purchase add-on packs of 100,000 calls/month under Settings → Billing → Add-ons.

All endpoints support cursor-based pagination via the cursor and limit query parameters. Maximum page size is 100 records.`,
  },
  {
    title: 'SSO Configuration (SAML & OIDC)',
    tags: ['sso', 'saml', 'oidc', 'identity', 'okta', 'azure-ad', 'jit', 'security'],
    content: `Single Sign-On (SSO) is available on Growth and Enterprise plans. We support SAML 2.0 and OpenID Connect (OIDC). Most enterprise identity providers — Okta, Azure AD, OneLogin, Ping Identity — work out of the box.

**SAML 2.0 setup**: In your IdP, create a new SAML app using the metadata XML available at Settings → Security → SSO → Download Metadata. Set the ACS URL to https://app.yourapp.com/auth/saml/callback and the Entity ID to https://app.yourapp.com. Map at least email, firstName, and lastName attributes. Once configured in your IdP, paste the IdP metadata URL or XML into our SSO settings page and click Test Connection before enabling.

**OIDC setup**: Register a new OAuth 2.0 application in your IdP. Set the redirect URI to https://app.yourapp.com/auth/oidc/callback. Copy the client ID, client secret, and discovery URL (/.well-known/openid-configuration) into our OIDC settings.

**Just-in-Time (JIT) provisioning**: New users who authenticate via SSO are automatically created in your workspace with the default role (configurable). If the user already exists, their profile is updated from the IdP attributes on each login.

**Enforcement**: Once SSO is configured, you can enforce it under Settings → Security → Require SSO. After enforcement, password-based login is disabled for all non-admin users. We recommend testing with a non-admin account before enforcing.`,
  },
  {
    title: 'Data Export & GDPR Compliance',
    tags: ['export', 'gdpr', 'data', 'compliance', 'csv', 'json', 'deletion', 'retention'],
    content: `We take data portability seriously. You can export your workspace data at any time without contacting support.

**Exporting workspace data**: Go to Settings → Data → Export. You can export all records, or filter by date range, record type, or user. Exports are generated asynchronously — for large workspaces (>100k records) this can take up to 30 minutes. You'll receive an email with a download link when ready. Export files are available for 7 days before deletion. Supported formats: CSV (flat tables) and JSON (hierarchical, preserves all fields including nested metadata).

**GDPR compliance**: We are GDPR compliant as a data processor. Our DPA is available for download at yourapp.com/legal/dpa. For data subject access requests (DSARs), workspace admins can export all data associated with a specific user email under Settings → Data → User Data Export. We respond to DSARs within 30 days as required.

**Right to erasure**: To permanently delete a user's data, go to Settings → Members, select the user, and choose Delete & Erase. This removes all PII from active records within 24 hours and from backups within 30 days. Deleted data is irrecoverable.

**Data retention**: By default, records are retained indefinitely. Enterprise plans can configure custom retention windows under Settings → Data → Retention Policy. Records older than the retention window are automatically purged on a nightly schedule.`,
  },
];

async function seed() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI not set in .env');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  // Drop and re-insert cleanly — idempotent so you can run this multiple times
  // without ending up with duplicate docs
  await Document.deleteMany({});
  console.log('Cleared existing documents');

  const inserted = await Document.insertMany(documents);
  console.log(`Seeded ${inserted.length} documents:`);
  inserted.forEach((d) => console.log(`  [${d._id}] ${d.title}`));

  await mongoose.disconnect();
  console.log('Done.');
}

seed().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
