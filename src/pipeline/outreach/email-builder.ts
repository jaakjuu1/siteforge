import type { Prospect } from "../crm/schema.js";

export interface AuditEmail {
  to: string;
  subject: string;
  body: string;
  htmlBody: string;
}

/**
 * Build a personalized audit email based on prospect's pain points.
 * Finnish language. Tone: professional, helpful, not salesy.
 */
export function buildAuditEmail(
  prospect: Prospect,
  variant: "direct" | "question" | "value" = "direct",
): AuditEmail {
  const painPoints = prospect.pain_points
    ? JSON.parse(prospect.pain_points) as string[]
    : [];

  const name = prospect.business_name;
  const city = prospect.city;
  const painScore = prospect.pain_score ?? 0;

  // Pick top 3 most impactful pain points
  const topPains = painPoints.slice(0, 3);

  const painBullets = topPains
    .map((p) => `• ${translatePainPoint(p)}`)
    .join("\n");

  const painBulletsHtml = topPains
    .map((p) => `<li style="margin-bottom: 8px;">${translatePainPoint(p)}</li>`)
    .join("\n");

  const subject = getSubject(variant, name);
  const body = getBody(variant, name, city, painBullets, painScore);
  const htmlBody = getHtmlBody(variant, name, city, painBulletsHtml, painScore);

  return {
    to: prospect.email ?? "",
    subject,
    body,
    htmlBody,
  };
}

function getSubject(
  variant: "direct" | "question" | "value",
  name: string,
): string {
  switch (variant) {
    case "direct":
      return `${name} — huomasimme verkkosivustossanne kehityskohteita`;
    case "question":
      return `Tuleeko ${name}:lle tarpeeksi yhteydenottoja verkosta?`;
    case "value":
      return `Ilmainen sivustoarvio: ${name}`;
  }
}

function getBody(
  variant: "direct" | "question" | "value",
  name: string,
  city: string,
  painBullets: string,
  painScore: number,
): string {
  const intro = {
    direct: `Hei,\n\nTein pikaisen arvion ${name}:n verkkosivustosta ja huomasin muutaman kohdan, jotka saattavat vaikuttaa asiakkaiden yhteydenottoihin.`,
    question: `Hei,\n\nOlen tutkinut ${city}n alueen yrityksiä verkossa ja ${name} kiinnitti huomioni. Tulevatko asiakkaanne pääasiassa suositusten kautta vai löytävätkö he teidät myös verkosta?`,
    value: `Hei,\n\nTein ilmaisen sivustoarvion ${name}:lle osana paikallisyritysten digitaalista kartoitusta ${city}n alueella.`,
  };

  const painSection =
    painBullets.length > 0
      ? `\nKonkreettiset havainnot:\n\n${painBullets}\n`
      : "";

  const cta = {
    direct: `Haluaisitteko nähdä tarkemman raportin ja ehdotuksen, miten nämä voisi korjata? Vastaa tähän viestiin niin lähetän sen — täysin velvoitteetta.`,
    question: `Jos teillä on kiinnostusta, voin lähettää ilmaisen raportin sivustostanne ja konkreettisia ehdotuksia asiakasvirran kasvattamiseksi. Vastaa tähän niin laitan tulemaan.`,
    value: `Täydellinen raportti on valmis — haluatteko nähdä sen? Vastaa tähän viestiin niin lähetän. Ei velvoitteita.`,
  };

  return `${intro[variant]}
${painSection}
${cta[variant]}

Ystävällisin terveisin,
Teppo Jaakkola
Verkkosivusto- ja digitaalinen kehitys
teppo@jaakkola.xyz
jaakkola.xyz`;
}

function getHtmlBody(
  variant: "direct" | "question" | "value",
  name: string,
  city: string,
  painBulletsHtml: string,
  painScore: number,
): string {
  const textBody = getBody(variant, name, city, "", painScore);

  // Simple HTML version — plain text-like but with styled pain points
  const lines = textBody.split("\n").map((line) => {
    if (line.startsWith("Konkreettiset havainnot:")) {
      return `<p><strong>${line}</strong></p>`;
    }
    if (line.trim() === "") return "<br>";
    return `<p style="margin: 0 0 4px 0;">${line}</p>`;
  });

  // Insert pain bullets after "Konkreettiset havainnot:"
  const painHtml =
    painBulletsHtml.length > 0
      ? `<p><strong>Konkreettiset havainnot:</strong></p><ul style="padding-left: 20px; margin: 8px 0 16px 0;">${painBulletsHtml}</ul>`
      : "";

  return `<!DOCTYPE html>
<html lang="fi">
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 15px; line-height: 1.6; color: #1e293b; max-width: 600px;">
${lines.filter((l) => !l.includes("Konkreettiset havainnot:") && !l.includes("• ")).join("\n")}
${painHtml}
</body>
</html>`;
}

/**
 * Translate technical pain points to business-friendly Finnish.
 */
function translatePainPoint(pain: string): string {
  const translations: Record<string, string> = {
    no_mobile_cta:
      "Mobiilisivustolta puuttuu selkeä yhteydenottopainike — jopa 60% kävijöistä selaa puhelimella",
    no_click_to_call:
      "Puhelinnumeroa ei voi klikata mobiilissa — jokainen ylimääräinen vaihe vähentää soittoja",
    no_contact_form:
      "Sivustolla ei ole yhteydenottolomaketta — osa asiakkaista haluaa jättää viestin ilta-aikaan",
    no_booking_widget:
      "Ajanvarausjärjestelmää ei ole integroitu sivustolle — moderni asiakas varaa ajan verkossa",
    no_https:
      "Sivusto ei käytä suojattua yhteyttä (HTTPS) — selaimet varoittavat tästä kävijöitä",
    no_schema:
      "Hakukonenäkyvyydestä puuttuu rakenteellinen data — Google ei näytä aukioloaikoja tai arvosteluja haussa",
    no_google_maps:
      "Karttaa ei ole sivustolla — asiakkaat eivät löydä perille helposti",
    slow_mobile:
      "Sivusto latautuu hitaasti mobiilissa — yli puolet kävijöistä poistuu jos lataus kestää yli 3 sekuntia",
    no_reviews:
      "Google-arvosteluja ei ole hyödynnetty sivustolla — arvostelut lisäävät luottamusta merkittävästi",
    outdated_info:
      "Sivuston tiedot saattavat olla vanhentuneita — tämä heikentää asiakkaiden luottamusta",
    poor_copy:
      "Sivuston tekstisisältö kaipaa päivitystä — selkeä viestintä lisää yhteydenottoja",
  };

  return translations[pain] ?? pain;
}

export function getEmailVariants(): ("direct" | "question" | "value")[] {
  return ["direct", "question", "value"];
}
