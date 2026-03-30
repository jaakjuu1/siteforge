import { getNiche } from "../config/niches.js";
import { upsertProspect, type InsertProspect } from "../crm/pipeline.js";
import { closeDb } from "../crm/db.js";

export interface ProspectRaw {
  business_name: string;
  address: string;
  city: string;
  phone: string | null;
  website: string | null;
  google_rating: number | null;
  review_count: number | null;
}

// --- Google Places API (Text Search) ---

interface PlacesResult {
  displayName?: { text: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
}

async function searchGooglePlaces(
  query: string,
  city: string,
  limit: number,
): Promise<ProspectRaw[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GOOGLE_PLACES_API_KEY not set. Set it in environment variables.",
    );
  }

  const textQuery = `${query} ${city}`;

  const response = await fetch(
    "https://places.googleapis.com/v1/places:searchText",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount",
      },
      body: JSON.stringify({
        textQuery,
        maxResultCount: Math.min(limit, 20),
        languageCode: "fi",
      }),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google Places API error ${response.status}: ${text}`);
  }

  const data = (await response.json()) as { places?: PlacesResult[] };
  const places = data.places ?? [];

  return places.map((p) => ({
    business_name: p.displayName?.text ?? "Tuntematon",
    address: p.formattedAddress ?? "",
    city,
    phone: p.nationalPhoneNumber ?? p.internationalPhoneNumber ?? null,
    website: p.websiteUri ?? null,
    google_rating: p.rating ?? null,
    review_count: p.userRatingCount ?? null,
  }));
}

// --- Finder.fi fallback scraper ---

async function searchFinder(
  query: string,
  city: string,
  limit: number,
): Promise<ProspectRaw[]> {
  const url = `https://www.finder.fi/search?what=${encodeURIComponent(query)}&where=${encodeURIComponent(city)}`;

  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Accept: "text/html",
    },
  });

  if (!response.ok) {
    console.warn(`Finder.fi returned ${response.status}, skipping`);
    return [];
  }

  const html = await response.text();
  const prospects: ProspectRaw[] = [];

  // Extract business cards from Finder.fi HTML
  // Pattern: JSON-LD or structured data blocks
  const jsonLdMatches = html.match(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
  );

  if (jsonLdMatches) {
    for (const match of jsonLdMatches) {
      if (prospects.length >= limit) break;
      try {
        const json = match
          .replace(/<script type="application\/ld\+json">/, "")
          .replace(/<\/script>/, "");
        const data = JSON.parse(json) as Record<string, unknown>;

        if (data["@type"] === "LocalBusiness" || data["@type"] === "Organization") {
          prospects.push({
            business_name: (data.name as string) ?? "Tuntematon",
            address: typeof data.address === "object"
              ? ((data.address as Record<string, string>)?.streetAddress ?? "")
              : "",
            city,
            phone: (data.telephone as string) ?? null,
            website: (data.url as string) ?? null,
            google_rating: null,
            review_count: null,
          });
        }
      } catch {
        // Skip malformed JSON-LD
      }
    }
  }

  // Fallback: regex-based extraction for business names and phones
  if (prospects.length === 0) {
    const nameMatches = html.match(
      /class="[^"]*hit-name[^"]*"[^>]*>([^<]+)</g,
    );
    if (nameMatches) {
      for (const m of nameMatches.slice(0, limit)) {
        const name = m.replace(/.*>/, "").trim();
        if (name) {
          prospects.push({
            business_name: name,
            address: "",
            city,
            phone: null,
            website: null,
            google_rating: null,
            review_count: null,
          });
        }
      }
    }
  }

  return prospects.slice(0, limit);
}

// --- Main search function ---

export async function searchProspects(options: {
  niche: string;
  city: string;
  limit?: number;
  source?: "google" | "finder" | "both";
}): Promise<ProspectRaw[]> {
  const { niche, city, limit = 20, source = "both" } = options;
  const nicheConfig = getNiche(niche);

  if (!nicheConfig) {
    throw new Error(
      `Unknown niche: ${niche}. Available: kampaamo, ravintola, autokorjaamo, hammaslääkäri`,
    );
  }

  const allProspects: ProspectRaw[] = [];
  const seen = new Set<string>();

  for (const term of nicheConfig.searchTerms) {
    if (allProspects.length >= limit) break;

    const remaining = limit - allProspects.length;

    if (source === "google" || source === "both") {
      try {
        const results = await searchGooglePlaces(term, city, remaining);
        for (const r of results) {
          const key = r.business_name.toLowerCase();
          if (!seen.has(key)) {
            seen.add(key);
            allProspects.push(r);
          }
        }
      } catch (err) {
        console.warn(`Google Places search failed for "${term}":`, err);

        // Fall back to Finder if Google fails and source is "both"
        if (source === "both") {
          try {
            const results = await searchFinder(term, city, remaining);
            for (const r of results) {
              const key = r.business_name.toLowerCase();
              if (!seen.has(key)) {
                seen.add(key);
                allProspects.push(r);
              }
            }
          } catch (finderErr) {
            console.warn(`Finder.fi also failed for "${term}":`, finderErr);
          }
        }
      }
    }

    if (source === "finder") {
      try {
        const results = await searchFinder(term, city, remaining);
        for (const r of results) {
          const key = r.business_name.toLowerCase();
          if (!seen.has(key)) {
            seen.add(key);
            allProspects.push(r);
          }
        }
      } catch (err) {
        console.warn(`Finder.fi failed for "${term}":`, err);
      }
    }
  }

  return allProspects.slice(0, limit);
}

// --- Save to CRM ---

export function saveProspectsToCrm(prospects: ProspectRaw[]): void {
  for (const p of prospects) {
    const data: InsertProspect = {
      business_name: p.business_name,
      city: p.city,
      address: p.address || undefined,
      phone: p.phone ?? undefined,
      website: p.website ?? undefined,
      google_rating: p.google_rating ?? undefined,
      review_count: p.review_count ?? undefined,
    };
    upsertProspect(data);
  }
}

// --- CLI ---

async function main() {
  const args = process.argv.slice(2);
  let niche = "kampaamo";
  let city = "Oulu";
  let limit = 20;
  let source: "google" | "finder" | "both" = "both";

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--niche":
        niche = args[++i];
        break;
      case "--city":
        city = args[++i];
        break;
      case "--limit":
        limit = parseInt(args[++i], 10);
        break;
      case "--source":
        source = args[++i] as "google" | "finder" | "both";
        break;
    }
  }

  console.log(`🔍 Searching ${niche} in ${city} (limit: ${limit}, source: ${source})...\n`);

  try {
    const prospects = await searchProspects({ niche, city, limit, source });

    console.log(`Found ${prospects.length} prospects:\n`);
    for (const p of prospects) {
      console.log(`  ${p.business_name}`);
      console.log(`    📍 ${p.address}`);
      console.log(`    📞 ${p.phone ?? "—"}`);
      console.log(`    🌐 ${p.website ?? "—"}`);
      console.log(
        `    ⭐ ${p.google_rating ?? "—"} (${p.review_count ?? 0} reviews)`,
      );
      console.log();
    }

    // Save to CRM
    saveProspectsToCrm(prospects);
    console.log(`✅ Saved ${prospects.length} prospects to CRM database`);
  } catch (err) {
    console.error("Search failed:", err);
    process.exit(1);
  } finally {
    closeDb();
  }
}

// Run CLI if executed directly
const isMain =
  process.argv[1]?.endsWith("search.ts") ||
  process.argv[1]?.endsWith("search.js");
if (isMain) {
  main();
}
