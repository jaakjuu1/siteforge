export interface SiteConfig {
  business: {
    name: string;
    tagline: string;
    description: string;
    phone: string;
    email: string;
    address: {
      street: string;
      city: string;
      zip: string;
      country: string;
    };
    hours: { day: string; hours: string }[];
    services: { title: string; description: string; icon: string }[];
    socialLinks: {
      facebook?: string;
      instagram?: string;
      twitter?: string;
      linkedin?: string;
      youtube?: string;
      tiktok?: string;
    };
  };
  theme: {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    fontFamily: string;
    headingFont: string;
    googleFontsUrl: string;
  };
  seo: {
    locale: string;
    siteUrl: string;
    defaultMetaDescription: string;
    ogImage: string;
  };
  features: {
    blog: boolean;
    contactForm: boolean;
    googleMaps: boolean;
    testimonials: boolean;
  };
  testimonials: {
    name: string;
    text: string;
    rating: number;
  }[];
  navigation: { label: string; href: string }[];
}

const siteConfig: SiteConfig = {
  business: {
    name: "Kampaamo Kirsikka",
    tagline: "Kauneutta ja tyyliä Oulun sydämessä",
    description:
      "Kampaamo Kirsikka on oululainen kampaamo, joka tarjoaa laadukkaita hiuspalveluita modernissa ja viihtyisässä ympäristössä. Meillä jokainen asiakas saa yksilöllistä palvelua.",
    phone: "+358 40 123 4567",
    email: "info@kampaamokirsikka.fi",
    address: {
      street: "Kirkkokatu 15",
      city: "Oulu",
      zip: "90100",
      country: "FI",
    },
    hours: [
      { day: "Maanantai", hours: "9:00 - 18:00" },
      { day: "Tiistai", hours: "9:00 - 18:00" },
      { day: "Keskiviikko", hours: "9:00 - 18:00" },
      { day: "Torstai", hours: "9:00 - 20:00" },
      { day: "Perjantai", hours: "9:00 - 18:00" },
      { day: "Lauantai", hours: "10:00 - 15:00" },
      { day: "Sunnuntai", hours: "Suljettu" },
    ],
    services: [
      {
        title: "Hiustenleikkuu",
        description:
          "Ammattimainen hiustenleikkuu naisille, miehille ja lapsille. Räätälöidään juuri sinulle sopiva tyyli.",
        icon: "scissors",
      },
      {
        title: "Värjäys",
        description:
          "Laadukkaat värjäyspalvelut perinteisestä kokoväreistä moderneihin balayage-tekniikoihin.",
        icon: "palette",
      },
      {
        title: "Kampaukset",
        description:
          "Upeita kampauksia juhliin, häihin ja muihin erityistilaisuuksiin. Meikki saatavilla lisäpalveluna.",
        icon: "sparkles",
      },
      {
        title: "Hiushoidot",
        description:
          "Elvyttävät ja kosteuttavat hiushoidot vahingoittuneille ja kuiville hiuksille.",
        icon: "heart",
      },
      {
        title: "Parturi",
        description:
          "Miesten parturipalvelut: leikkuu, parranajo ja muotoilu perinteisellä ammattitaidolla.",
        icon: "user",
      },
      {
        title: "Hiustenpidennykset",
        description:
          "Laadukkaista aidoista hiuksista tehdyt pidennykset luonnollisen näköiseen lopputulokseen.",
        icon: "wand",
      },
    ],
    socialLinks: {
      facebook: "https://facebook.com/kampaamokirsikka",
      instagram: "https://instagram.com/kampaamokirsikka",
    },
  },
  theme: {
    primaryColor: "#be185d",
    secondaryColor: "#1e293b",
    accentColor: "#f472b6",
    fontFamily: "Inter",
    headingFont: "Playfair Display",
    googleFontsUrl:
      "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@400;600;700&display=swap",
  },
  seo: {
    locale: "fi_FI",
    siteUrl: "https://kampaamokirsikka.fi",
    defaultMetaDescription:
      "Kampaamo Kirsikka - Laadukkaat hiuspalvelut Oulun keskustassa. Hiustenleikkuut, varjaykset, kampaukset ja hiushoidot ammattitaidolla.",
    ogImage: "/og-image.jpg",
  },
  features: {
    blog: true,
    contactForm: true,
    googleMaps: true,
    testimonials: true,
  },
  testimonials: [
    {
      name: "Maria K.",
      text: "Paras kampaamo Oulussa! Olen käynyt täällä vuosia ja aina lähden tyytyväisenä. Henkilökunta on ammattitaitoista ja ystävällistä.",
      rating: 5,
    },
    {
      name: "Tiina S.",
      text: "Upea balayage-värjäys! Juuri sellainen kuin toivoin. Kiitos ihanasta palvelusta!",
      rating: 5,
    },
    {
      name: "Jukka L.",
      text: "Rento tunnelma ja hyvät parturipalvelut. Ei tarvitse muualle mennä.",
      rating: 5,
    },
    {
      name: "Anna P.",
      text: "Häihin tehty kampaus oli upea. Suosittelen ehdottomasti kaikille!",
      rating: 4,
    },
  ],
  navigation: [
    { label: "Etusivu", href: "/" },
    { label: "Palvelut", href: "/#palvelut" },
    { label: "Meista", href: "/#meista" },
    { label: "Arvostelut", href: "/#arvostelut" },
    { label: "Blogi", href: "/blog" },
    { label: "Yhteystiedot", href: "/#yhteystiedot" },
  ],
};

export default siteConfig;
