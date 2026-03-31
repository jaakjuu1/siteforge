# SiteForge Pipeline — Architecture v2

## Business Model (revised after discovery rethink)
- **Offer:** "Lisää tarjouspyyntöjä, soittoja ja näkyvyyttä" — EI vain "uusi sivu"
- **Pricing:** €1200 setup + €99/kk (12kk sopimus) = €1200 + €1188/vuosi
- **Target:** 20 asiakasta × €99/kk = €1,980/kk recurring + setupit
- **Niche-first:** rakennusalan paikalliset palveluyritykset ensin (sähkö, LVI, saumaus)
- **Discovery-first correction:** emme etsi hakukoneen voittajia vaan alinäkyviä paikallisia yrityksiä
- **Stack:** Astro 5 + Tailwind CSS 4 + TypeScript, Hetzner (Caddy)

## Sales Funnel (maps-first, audit-first, NOT demo-first)
```
1. Maps/listings discovery (find real local businesses without SEO bias)
2. Fit-gate (reject chains, enterprise, ecommerce, complex functionality)
3. Visibility-gap qualification (who is underpowered online vs real business potential)
4. Send personalized AUDIT email (what they're losing)
5. Wait for warm reply
6. ONLY THEN generate demo site
7. Present demo + close
```

## Qualification Scoring (opportunity, not visible-search weakness)
We no longer score only pain. We score opportunity.

Primary filters:
- [ ] Not a chain / enterprise
- [ ] Not ecommerce-heavy
- [ ] Not portal / complex booking dependent
- [ ] Fits SiteForge replacement model

Primary scores:
- **Visibility gap** — how weak the digital presence is relative to real business presence
- **SiteForge fit** — can our product realistically improve or replace the site
- **Commercial upside** — would better visibility and conversion likely create revenue
- **Pain score** — conversion / SEO / trust issues on the current website

## Pipeline Phases

### Phase 1: MAPS-FIRST PROSPECTOR
```
Input: niche + city/region (e.g., "sähkö" + "Jyväskylä")
    → Google Maps / Places / Finder / local listings
    → Raw business list (name, address, phone, domain, reviews, maps source)
    → Fit gate (chain? enterprise? ecommerce? complex functionality?)
    → Website + visibility enrichment
    → Visibility-gap scoring
    → SiteForge-fit scoring
    → Commercial-upside scoring
    → Only then: shortlist for audit
```

### Phase 2: AUDIT + OUTREACH
```
For qualified prospects (score >= 6):
    → Generate personalized audit report (PDF or email)
    → Highlight specific losses (e.g., "no mobile CTA = ~30% lost calls")
    → Send via teppo@jaakkola.xyz (warmed, SPF/DKIM/DMARC)
    → Track opens/replies
    → Follow up once after 3 days
```

### Phase 3: DEMO GENERATION (warm leads only)
```
When prospect replies positively:
    → Fork siteforge template
    → AI reads old site → generates site.config.ts
    → Coding agent customizes theme + content
    → Deploy: [client].staging.siteforge.jaakkola.xyz
    → Present in call/email
```

### Phase 4: CLIENT ONBOARDING
```
After close:
    → Contract (e-sign)
    → Invoice (€1200 setup)
    → Asset collection (logo, photos, content)
    → DNS playbook (Cloudflare preferred)
    → Production deploy: client's domain
    → Analytics setup (Plausible/Umami)
    → Monthly report template
```

### Phase 5: AI MAINTENANCE (structured edits only)
```
Allowed AI edits (no manual review needed):
    → site.config.ts (hours, phone, services, prices)
    → Blog drafts (monthly, requires approval)
    → Content text updates
    → Image swaps in public/

NOT allowed without human review:
    → Layout/component changes
    → New pages
    → Third-party integrations
    → Anything in regulated industries (health/legal)
```

## Technical Structure

```
siteforge-pipeline/
├── prospector/
│   ├── search.ts         # Google Places API + Finder.fi
│   ├── enrich.ts         # Extract website info, phone, hours
│   ├── screenshot.ts     # Playwright mobile + desktop screenshots
│   ├── audit.ts          # Lighthouse + custom checks
│   ├── score.ts          # Business pain scoring (0-10)
│   └── report.ts         # Generate audit report
├── outreach/
│   ├── email-builder.ts  # Personalized audit email
│   ├── sender.ts         # SMTP via teppo@jaakkola.xyz
│   └── tracker.ts        # Open/reply tracking
├── generator/
│   ├── site-reader.ts    # Read old website → extract info
│   ├── config-gen.ts     # Generate site.config.ts from extracted data
│   ├── fork-deploy.ts    # GitHub fork + Caddy wildcard setup
│   └── customize.ts      # Coding agent customizes per client
├── onboarding/
│   ├── contract.ts       # E-sign generation
│   ├── invoice.ts        # Invoice generation
│   ├── dns-playbook.ts   # DNS setup checklist + verification
│   └── analytics.ts      # Plausible/Umami setup
├── maintenance/
│   ├── structured-edit.ts # Safe AI edits (config + content only)
│   ├── staging.ts         # Preview deploy
│   ├── promote.ts         # Staging → production (with approval)
│   ├── blog-writer.ts     # Monthly draft generation
│   └── rollback.ts        # Rollback to previous version
├── crm/
│   ├── db.ts             # SQLite database
│   ├── schema.ts         # Prospects, clients, interactions
│   └── pipeline.ts       # Lead stages: found → qualified → contacted → warm → demo → closed → active
└── config/
    ├── niches.ts         # Niche definitions (kampaamo, ravintola, etc.)
    └── templates.ts      # Email templates per niche
```

## Hosting Architecture
- Template: github.com/jaakjuu1/siteforge
- Per-client: github.com/jaakjuu1/siteforge-[clientname]
- Production: client domain → Caddy file_server on Hetzner
- Staging: *.staging.siteforge.jaakkola.xyz → Caddy wildcard
- All static (Astro SSG) → no port conflicts

## Email Setup Requirements
- [ ] SPF record for jaakkola.xyz
- [ ] DKIM signing
- [ ] DMARC policy
- [ ] Warm domain slowly (5-10 emails/day first week)
- [ ] Separate sending subdomain (e.g., mail.jaakkola.xyz)
- [ ] Suppression list / unsubscribe handling

## Build Priority
1. **Prospector** (search + screenshot + audit + score)
2. **CRM** (SQLite + pipeline stages)
3. **Outreach** (audit email + sender)
4. **Generator** (fork + config gen + deploy)
5. **Onboarding** (contract + invoice + DNS)
6. **Maintenance** (structured edits + blog)

## Validation Before Full Build
Before building phases 3-6, validate with manual outreach:
- Contact 30-50 local contractor businesses (sähkö / LVI / saumaus)
- Source them from maps/listings, not search winners
- Test 3 audit email variants
- Measure: reply rate, interest rate, objections
- Minimum viable: 3-5 positive replies before building demo generator
