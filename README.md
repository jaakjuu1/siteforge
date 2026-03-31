# SiteForge

Astro-pohjainen verkkosivupohja paikallisten palveluyritysten sivustoille. Muokkaa `site.config.ts`, lisää sisältöä, ja sivusto on valmis.

## Discovery direction

SiteForge ei enää perustu ensisijaisesti hakukoneen näkyvien voittajien auditointiin.

Uusi suunta on **maps-first discovery**:
- löydä oikeat paikalliset yritykset maps/listings-datasta
- karsi pois ketjut, enterprise-toimijat ja ecommerce-heavy caset
- arvioi visibility gap + SiteForge fit + commercial upside
- rakenna demo vasta oikeasti sopiville kohteille

Katso tarkempi malli tiedostosta `MAPS_FIRST_DISCOVERY.md`.

## Teknologiat

- **Astro 6** - staattinen sivugeneraattori
- **Tailwind CSS 4** - utility-first CSS
- **TypeScript** - tyyppiturvallinen konfiguraatio
- **Content Collections** - Markdown-blogipostaukset

## Pikakaynnistys

```bash
# Kloonaa ja asenna
git clone <repo-url> my-client-site
cd my-client-site
npm install

# Kaynnista kehityspalvelin
npm run dev
```

## Uuden asiakkaan sivusto

### Vaihtoehto 1: Skriptilla

```bash
./scripts/new-client.sh "Yrityksen Nimi" "Kaupunki"
```

Skripti paivittaa yrityksen nimen, kaupungin ja URL-osoitteet automaattisesti.

### Vaihtoehto 2: Kasin

1. Muokkaa `site.config.ts` - kaikki sivuston asetukset yhdessa tiedostossa:
   - Yrityksen tiedot (nimi, puhelin, osoite, aukioloajat)
   - Palvelut
   - Teema (varit, fontit)
   - SEO-asetukset
   - Ominaisuustoggle (blogi, yhteydenottolomake, Google Maps, arvostelut)

2. Lisaa blogipostauksia `src/content/blog/` -kansioon Markdown-muodossa

3. Vaihda kuvat (hero, about-osio, blogikuvat)

4. Paivita `public/robots.txt` oikealla domainilla

## site.config.ts -rakenne

```typescript
{
  business: {     // Yrityksen tiedot, palvelut, aukioloajat, some-linkit
  },
  theme: {        // Varit, fontit, Google Fonts -URL
  },
  seo: {          // Locale, site URL, meta description, OG-kuva
  },
  features: {     // Blogi, yhteydenottolomake, kartta, arvostelut on/off
  },
  testimonials: [ // Asiakasarvostelut
  ],
  navigation: [   // Navigaatiolinkit
  ]
}
```

## Blogipostaukset

Lisaa `.md`-tiedostoja `src/content/blog/` -kansioon:

```markdown
---
title: "Postauksen otsikko"
description: "Lyhyt kuvaus"
date: 2025-01-15
image: "https://example.com/kuva.jpg"
tags: ["tagi1", "tagi2"]
---

Sisalto tahan...
```

## SEO (sisaanrakennettu)

- Schema.org LocalBusiness JSON-LD joka sivulla
- Automaattinen sitemap.xml
- robots.txt
- Open Graph + Twitter Card -metatagit
- Kanoninen URL
- Oikea otsikkohierarkia

## Komennot

| Komento           | Toiminto                      |
|-------------------|-------------------------------|
| `npm run dev`     | Kaynnista kehityspalvelin     |
| `npm run build`   | Rakenna tuotantoversio        |
| `npm run preview` | Esikatsele tuotantoversiota   |

## Rakenteen yleiskatsaus

```
site.config.ts          # Koko sivuston konfiguraatio
src/
  components/
    Header.astro        # Responsiivinen navigaatio
    Hero.astro          # Hero-osio CTA-painikkeilla
    Services.astro      # Palveluruudukko configista
    About.astro         # Tietoa meista + aukioloajat
    Testimonials.astro  # Asiakasarvostelut
    Contact.astro       # Yhteydenottolomake + tiedot
    BlogList.astro      # Viimeisimmat blogipostaukset
    Footer.astro        # Alatunniste + some-linkit
    SEOHead.astro       # Meta, OG, JSON-LD
  layouts/
    Layout.astro        # Perusasettelu
  pages/
    index.astro         # Etusivu
    404.astro           # Virhesivu
    blog/
      index.astro       # Blogi-listaus
      [...slug].astro   # Yksittainen postaus
  content/
    blog/               # Markdown-blogipostaukset
  styles/
    global.css          # Tailwind + mukautetut tyylit
scripts/
  new-client.sh         # Uuden asiakkaan pika-asennus
```
