# SiteForge Maps-First Discovery System

## Purpose

This system exists to find **local businesses we can actually help**.

It is designed specifically to avoid the old mistake:
- do **not** start from visible search winners
- do **not** optimize for "which already-visible website has the most obvious flaws"

Instead, this system optimizes for:
- real local businesses
- real commercial upside
- weak or underpowered digital presence
- strong fit for a SiteForge-style replacement

---

## Core principle

**We are not hunting ugly websites.**

We are hunting:
> local service businesses whose online presence is weaker than their real business deserves.

That means the correct discovery source is:
- **Google Maps / Places / directory-style local business data first**
- website audit second
- demo generation last

---

## Why search-first was wrong

Search-first discovery has built-in bias.

Search engines tend to show:
- businesses that already rank
- businesses with decent SEO
- businesses with stronger domains
- businesses that are already visible enough to win clicks

That means search-first discovery tends to surface businesses that are already doing relatively okay online.

This is the wrong target for SiteForge.

---

## Why maps-first is better

Maps / Places data shows real local businesses without the same SEO pre-filter.

That helps us find businesses that:
- have real operations
- have a phone number and location
- may have reviews and trust in the market
- may still have weak, outdated, or missing websites
- may have poor conversion paths and weak local SEO

This is exactly where SiteForge can create lift.

---

## Discovery flow

```txt
Google Places / Maps
  -> raw local business list
  -> reject bad-fit businesses
  -> audit current website
  -> score visibility gap + fit + upside
  -> shortlist best opportunities
  -> outreach / audit
  -> demo only after strong validation
```

---

## Current implementation

### 1. Raw business discovery
Primary source currently used:
- **Google Places API**

Current implementation path:
- `src/pipeline/prospector/search.ts`

The system can query by:
- niche
- city
- result limit

Example:
```bash
GOOGLE_PLACES_API_KEY=... npx tsx src/pipeline/prospector/search.ts --niche sahko --city Jyväskylä --limit 20 --source google
```

### 2. Maps-first ranking pipeline
Current implementation path:
- `src/pipeline/prospector/maps-first.ts`

This pipeline:
1. collects local businesses
2. saves them to CRM
3. audits their sites
4. calculates multiple scores
5. disqualifies bad-fit businesses
6. ranks opportunities

Example:
```bash
GOOGLE_PLACES_API_KEY=... npx tsx src/pipeline/prospector/maps-first.ts --niche sahko --city Jyväskylä --limit 20
```

---

## Scoring model

The system no longer uses only pain score.

It uses four layers:

### 1. Pain score
Measures visible website problems.

Examples:
- no mobile CTA
- no contact form
- no schema
- no Google Maps embed
- poor conversion structure

Code:
- `src/pipeline/prospector/score.ts`
- `calculatePainScore()`

### 2. SiteForge fit score
Measures whether our product can realistically improve or replace the site.

Good fit:
- local service business
- brochure / lead-gen style company
- no heavy app logic
- no portal dependency
- no ecommerce complexity

Bad fit:
- chain / enterprise
- ecommerce-heavy
- portal / member area
- advanced booking dependency

Code:
- `src/pipeline/prospector/score.ts`
- `calculateSiteforgeFit()`

### 3. Visibility gap score
Measures how much mismatch there is between real business presence and weak digital presence.

Examples:
- decent review count, weak site
- good local trust, weak web conversion
- has a website, but current site underperforms
- no site at all = even larger gap

This score is currently computed inside:
- `src/pipeline/prospector/maps-first.ts`

### 4. Commercial upside score
Measures whether a better website + better visibility likely creates revenue.

Best-fit businesses:
- local contractors
- high-trust services
- businesses where quote requests and calls matter
- service areas where local SEO and trust content matter

This score is currently computed inside:
- `src/pipeline/prospector/maps-first.ts`

### Final ranking
Current formula:
```txt
opportunity_score = visibility_gap * 0.4 + fit * 0.35 + commercial_upside * 0.25
```

This can evolve later, but this is the current logic.

---

## Disqualification rules

A business should be rejected before demo generation if it is not a good fit.

### Current disqualifiers
- chain or enterprise operator
- ecommerce-heavy website
- portal / member area
- advanced booking flow

### Examples
- Terveystalo
- Mehiläinen
- businesses with webshop logic
- businesses whose website is already too advanced for SiteForge to replace cleanly

Implementation:
- `calculateSiteforgeFit()` in `src/pipeline/prospector/score.ts`

Disqualification is stored with:
- `fit_status`
- `disqualified_reason`

---

## Target niches

Current strong-fit niches:
- sähkö
- LVI
- saumaus

Why these work:
- local service businesses
- clear commercial intent
- trust-sensitive categories
- calls and tarjouspyynnöt matter
- blog/content can strengthen local SEO
- many operators are still digitally underpowered

---

## CRM fields currently used

The system currently uses / writes these important values:
- `pain_score`
- `siteforge_fit_score`
- `fit_status`
- `disqualified_reason`
- `status`

Relevant files:
- `src/pipeline/crm/schema.ts`
- `src/pipeline/crm/pipeline.ts`

---

## Current tested result pattern

The first meaningful validated test was:
- niche: **sähkö**
- city: **Jyväskylä**
- source: **Google Places API**

That produced a much more useful shortlist than the old search-first model.

Examples of strong candidates surfaced:
- Sähkötyö Rentola Oy
- Vaajakosken Sähkö- ja Putkipalvelu Oy
- Sähkö-Mesta Oy
- Jyväskylän Sähköasennus
- Sähkötyö Riihinen Oy

Examples of automatic disqualification:
- ecommerce-like cases
- obvious chain / enterprise cases

---

## Important correction from earlier iterations

Earlier discovery was wrong because it leaned too much on visible search results.

That led to selecting businesses that:
- already had decent sites
- ranked visibly already
- were not the highest-upside businesses for us

The new system corrects that by:
- using local business source data first
- then ranking opportunities by fit and upside

This was the key strategic correction.

---

## What this system is NOT for

It is not for:
- finding the prettiest redesign target
- targeting chains
- targeting ecommerce businesses
- targeting already-strong digital operators
- demo generation before validation

---

## Recommended operating process

### Step 1
Run maps-first discovery for one niche + one city.

### Step 2
Review the top 5 manually.

### Step 3
Reject false positives manually if needed.

### Step 4
Choose 1–3 strongest opportunities.

### Step 5
Only after that:
- audit outreach
- or demo generation

### Important
Do **not** jump straight from ranking to demo creation without sanity-checking the shortlist.

---

## Current known limitations

### 1. Google Places dependency
At the moment, the best working source is Google Places.
This requires a valid key.

### 2. Visibility gap still heuristic
The current visibility-gap score is useful, but still heuristic.
It can be improved later with richer source data.

### 3. Name cleanup
Some business names still arrive messy from source data and may need normalization.

### 4. Manual review still matters
The system is good for narrowing the field, not replacing judgment.

---

## Future improvements

Potential next upgrades:
- add `source_type` to CRM
- add `maps_url`
- add `opportunity_score` to CRM directly
- add better business-name normalization
- add website-missing prioritization
- add richer review-based heuristics
- add direct outreach export for top-ranked prospects

---

## Minimal command reference

### Search raw local businesses
```bash
GOOGLE_PLACES_API_KEY=... npx tsx src/pipeline/prospector/search.ts --niche sahko --city Jyväskylä --limit 20 --source google
```

### Run maps-first ranking
```bash
GOOGLE_PLACES_API_KEY=... npx tsx src/pipeline/prospector/maps-first.ts --niche sahko --city Jyväskylä --limit 20
```

---

## Summary

This system exists to answer one question:

> Which local businesses are realistic SiteForge clients with the biggest upside?

The answer should come from:
- local business source data first
- fit filtering second
- website audit third
- demos only after validation

That is the current SiteForge discovery system.
