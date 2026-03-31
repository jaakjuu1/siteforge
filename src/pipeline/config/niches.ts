export interface NicheConfig {
  slug: string;
  name: string;
  searchTerms: string[];
  serviceTypes: string[];
  painSignals: string[];
}

export const niches: Record<string, NicheConfig> = {
  kampaamo: {
    slug: "kampaamo",
    name: "Kampaamo / Parturi",
    searchTerms: ["kampaamo", "parturi", "hiussalonki", "parturi-kampaamo"],
    serviceTypes: [
      "hiustenleikkuu",
      "värjäys",
      "permanentti",
      "kampaus",
      "parranajo",
      "hiustenhoito",
    ],
    painSignals: [
      "ei ajanvarausta netissä",
      "ei hinnastoa sivuilla",
      "ei mobiili-CTA:ta",
      "ei Google-arvosteluja sivuilla",
      "vanhat aukioloajat",
    ],
  },
  ravintola: {
    slug: "ravintola",
    name: "Ravintola / Lounaspaikka",
    searchTerms: ["ravintola", "lounasravintola", "ruokapaikka", "kahvila"],
    serviceTypes: [
      "lounas",
      "à la carte",
      "catering",
      "take away",
      "tilausravintola",
      "kahvila",
    ],
    painSignals: [
      "ei lounaslista netissä",
      "ei tilausmahdollisuutta",
      "ei ruokalistaa",
      "ei aukioloaikoja",
      "ei mobiilisivua",
    ],
  },
  autokorjaamo: {
    slug: "autokorjaamo",
    name: "Autokorjaamo / Huolto",
    searchTerms: ["autokorjaamo", "autohuolto", "rengas", "katsastus"],
    serviceTypes: [
      "huolto",
      "korjaus",
      "rengastyö",
      "katsastus",
      "maalaus",
      "peltikorjaus",
    ],
    painSignals: [
      "ei ajanvarausta",
      "ei palvelulistaa",
      "ei hinnastoa",
      "ei sijaintitietoja",
      "ei arvosteluja",
    ],
  },
  hammaslääkäri: {
    slug: "hammaslääkäri",
    name: "Hammaslääkäri / Hammasklinikka",
    searchTerms: ["hammaslääkäri", "hammasklinikka", "hammashoitola", "hammashoito"],
    serviceTypes: ["tarkastus", "paikkaus", "juurihoito", "oikominen", "valkaisu", "implantti"],
    painSignals: [
      "ei ajanvarausta netissä",
      "ei palvelukuvauksia",
      "ei hinnastoa",
      "ei päivystystietoja",
      "vanhat tiedot",
    ],
  },
  saumaus: {
    slug: "saumaus",
    name: "Saumaus / Rakennussaumaus",
    searchTerms: ["saumaus", "rakennussaumaus", "elementtisaumaus", "palokatko"],
    serviceTypes: ["elementtisaumaus", "palokatkot", "massaus", "julkisivusaumaus", "korjaussaumaus"],
    painSignals: [
      "ei referenssejä",
      "ei tarjouspyyntö CTA:ta",
      "ei toimialueita",
      "ei projektikuvia",
      "ei yhteydenottolomaketta",
    ],
  },
  lvi: {
    slug: "lvi",
    name: "LVI / Putkiurakoitsija",
    searchTerms: ["LVI", "putkiliike", "putkimies", "IV-urakointi", "lämmitys"],
    serviceTypes: ["putkityöt", "huolto", "asennus", "iv-työt", "lämmitysjärjestelmät"],
    painSignals: [
      "ei päivystysnumeroa näkyvästi",
      "ei palvelualuetta",
      "ei tarjouspyyntöä",
      "ei referenssejä",
      "ei luottamussignaaleja",
    ],
  },
  sahko: {
    slug: "sahko",
    name: "Sähköurakoitsija",
    searchTerms: ["sähköurakoitsija", "sähköliike", "sähköasennus", "sähkömies"],
    serviceTypes: ["sähköasennus", "sähkösaneeraus", "vikapäivystys", "autolataus", "urakointi"],
    painSignals: [
      "ei päivystys CTA:ta",
      "ei palvelulistausta",
      "ei yritysesittelyä",
      "ei referenssejä",
      "ei yhteydenottolomaketta",
    ],
  },
};

export function getNiche(slug: string): NicheConfig | undefined {
  return niches[slug];
}

export function listNiches(): string[] {
  return Object.keys(niches);
}
