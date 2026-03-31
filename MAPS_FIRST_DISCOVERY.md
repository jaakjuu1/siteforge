# Maps-First Discovery — SiteForge v3

## Core idea

**Do not start from search winners.**

If we use web search as the main discovery source, we mostly find businesses that already:
- rank well
- have decent websites
- have some SEO competence
- are already visible

That creates the wrong pipeline.

We do **not** want to optimize for:
> "Which visible website has the most audit problems?"

We want to optimize for:
> "Which real local business has the biggest upside if we improve its website + local SEO + content?"

So discovery must become **maps-first**, not search-first.

---

## The actual target

We are looking for businesses that are:
- small and local
- service businesses
- commercially healthy enough to buy help
- underpowered online
- not chains
- not enterprise
- not ecommerce-heavy
- not dependent on complex booking/product logic

### Best-fit examples
- sähköurakoitsija
- LVI-yritys
- saumausyritys
- kattotyöt
- pienremontit
- putkiliike
- ilmanvaihto
- maalaus / pinnoitus
- julkisivutyöt

### Bad-fit examples
- ketjut
- franchising-brändit
- enterprise-toimijat
- verkkokaupat
- monimutkaiset ajanvarausalustat
- isot monitoimipisteiset toimijat
- yritykset, joilla on jo vahva näkyvyys + hyvä sivusto

---

## Why Maps is better than search

Google/Maps-style data is better because it gives us businesses without SEO pre-filtering.

From maps/listings we can find businesses that:
- have real operations
- have reviews
- have an address / service area
- may have a weak or missing website
- may have no service pages, no CTA, no local SEO, no content

This is where SiteForge can create real lift.

Search engines are still useful, but only **after** the business is found.

### Search should be used for:
- finding the business website if missing
- checking current visibility
- comparing against competitors
- enrichment

### Search should NOT be used for:
- primary prospect discovery
- deciding who is worth targeting

---

## New discovery logic

### Stage 1 — Raw local business discovery
Source businesses from maps/listings, not web search.

Candidate sources:
- Google Maps / Places API
- Finder / Fonecta / yrityshakemistot
- local directories
- industry-specific contractor listings
- municipal business lists where relevant

Fields we want as early as possible:
- business_name
- category / niche
- city
- address
- service_area
- phone
- website
- review_count
- google_rating
- maps_url
- source

---

### Stage 2 — Fit gate before audit
Before spending time or credits auditing a site, reject obvious bad fits.

## Disqualify immediately if:
- chain / enterprise brand
- multi-location national operator
- ecommerce-heavy site
- portal / member login / complex app behavior
- advanced booking flow central to business
- website already clearly strong enough that replacement upside is low

Save reason as structured value:
- `chain_or_enterprise`
- `advanced_functionality:ecommerce`
- `advanced_functionality:portal`
- `advanced_functionality:booking`
- `already_strong_visibility`
- `not_siteforge_fit`

---

### Stage 3 — Visibility gap scoring
This becomes the key scoring layer.

We should estimate:

#### 1. Business reality score
Does this look like a real local operating business?
Signals:
- map listing exists
- reviews exist
- phone/address present
- niche makes sense
- service area makes sense

#### 2. Visibility gap score
How underpowered is their web presence relative to the business?
Signals:
- decent review count but weak site
- weak service pages
- no CTA
- no schema
- no location/service area SEO
- no blog/content
- no trust sections / references
- poor mobile conversion flow
- no quote request path

#### 3. SiteForge fit score
Can our product realistically improve/replace this site?
Signals:
- brochure/service-business structure
- lead-gen focused
- no heavy app logic
- local landing pages / blog / CTA would help

#### 4. Commercial upside score
Would improving visibility plausibly create revenue?
Best examples:
- high-ticket or repeat service
- geographically bounded demand
- trust-sensitive category
- category where content + local SEO matters

---

## New winning formula
A business should become a priority only if it has:

- **real local business presence**
- **high visibility gap**
- **high SiteForge fit**
- **good commercial upside**
- **not a chain / not enterprise / not ecommerce**

So the new ranking is not:

`pain_score DESC`

It becomes something like:

`opportunity_score = visibility_gap + siteforge_fit + commercial_upside`

And only after passing fit gates.

---

## Revised pipeline

```txt
maps/listings discovery
  -> raw local businesses
  -> fit gate
  -> website + visibility enrichment
  -> visibility gap scoring
  -> opportunity ranking
  -> shortlist
  -> audit report / outreach
  -> demo only for strongest realistic targets
```

Not:

```txt
search results
  -> audit visible winners
  -> pick one with problems
```

---

## Concrete selection heuristics

### Strong candidate
- local contractor in one city/region
- 10–80 reviews
- real website exists but weak
- weak or missing CTA
- no quote flow
- weak trust/references
- weak local SEO content
- likely owner-operated or small team

### Medium candidate
- okay site, but weak conversion
- sparse service pages
- no content engine
- no blog / no authority pages
- good reviews, weak digital conversion

### Bad candidate
- ranks well already + site is competent
- chain / enterprise / national operator
- ecommerce-heavy
- directory/aggregator page
- technically broken in a way that suggests infrastructure complexity instead of simple upside

---

## Recommended first niches

### Priority 1
- sähkö
- LVI
- saumaus

### Why these
- real service demand
- high trust importance
- local search matters
- quote-request flow matters
- blog/content can create upside
- many players are still digitally underpowered

---

## What needs to change in code

### CRM additions
Potential fields:
- `source_type` (`maps`, `finder`, `search`, `manual`)
- `maps_url`
- `visibility_gap_score`
- `commercial_upside_score`
- `opportunity_score`
- `service_area`
- `review_velocity` (optional later)

### New statuses
Suggested:
- `found_raw`
- `fit_rejected`
- `visibility_qualified`
- `audit_ready`
- `qualified`

### New modules
Suggested structure:
- `prospector/maps-search.ts`
- `prospector/listing-enrich.ts`
- `prospector/fit-gate.ts`
- `prospector/opportunity-score.ts`

---

## Immediate next implementation steps

### Step 1
Replace search-first discovery strategy in docs and architecture.

### Step 2
Add source-aware fields to CRM.

### Step 3
Implement maps/listing ingestion.

### Step 4
Score businesses based on:
- local reality
- visibility gap
- siteforge fit
- commercial upside

### Step 5
Only after that run full audit + enrichment.

---

## Final principle

**We are not hunting bad-looking websites.**

We are hunting:
> small local businesses with real revenue potential whose digital presence is weaker than their business deserves.

That is the correct SiteForge discovery model.
