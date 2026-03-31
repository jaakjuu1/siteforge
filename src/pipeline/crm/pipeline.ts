import { getDb } from "./db.js";
import type {
  Prospect,
  ProspectStatus,
  Interaction,
  InteractionType,
  Client,
  ClientStatus,
} from "./schema.js";

export interface InsertProspect {
  business_name: string;
  city: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  google_rating?: number;
  review_count?: number;
}

export function upsertProspect(data: InsertProspect): Prospect {
  const db = getDb();

  const existing = db
    .prepare("SELECT id FROM prospects WHERE business_name = ? AND city = ?")
    .get(data.business_name, data.city) as { id: number } | undefined;

  if (existing) {
    db.prepare(
      `UPDATE prospects SET
        address = COALESCE(?, address),
        phone = COALESCE(?, phone),
        email = COALESCE(?, email),
        website = COALESCE(?, website),
        google_rating = COALESCE(?, google_rating),
        review_count = COALESCE(?, review_count),
        updated_at = datetime('now')
      WHERE id = ?`,
    ).run(
      data.address ?? null,
      data.phone ?? null,
      data.email ?? null,
      data.website ?? null,
      data.google_rating ?? null,
      data.review_count ?? null,
      existing.id,
    );
    return getProspect(existing.id)!;
  }

  const result = db
    .prepare(
      `INSERT INTO prospects (business_name, city, address, phone, email, website, google_rating, review_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      data.business_name,
      data.city,
      data.address ?? null,
      data.phone ?? null,
      data.email ?? null,
      data.website ?? null,
      data.google_rating ?? null,
      data.review_count ?? null,
    );

  return getProspect(Number(result.lastInsertRowid))!;
}

export function getProspect(id: number): Prospect | undefined {
  return getDb().prepare("SELECT * FROM prospects WHERE id = ?").get(id) as Prospect | undefined;
}

export function updateProspectStatus(id: number, status: ProspectStatus): void {
  getDb()
    .prepare("UPDATE prospects SET status = ?, updated_at = datetime('now') WHERE id = ?")
    .run(status, id);
}

export function updateProspectAudit(
  id: number,
  data: {
    screenshot_desktop?: string;
    screenshot_mobile?: string;
    lighthouse_score?: number | null;
    pain_score?: number;
    siteforge_fit_score?: number;
    fit_status?: string;
    disqualified_reason?: string | null;
    pain_points?: string[] | string;
  },
): void {
  const db = getDb();
  const sets: string[] = [];
  const vals: unknown[] = [];

  if (data.screenshot_desktop !== undefined) {
    sets.push("screenshot_desktop = ?");
    vals.push(data.screenshot_desktop);
  }
  if (data.screenshot_mobile !== undefined) {
    sets.push("screenshot_mobile = ?");
    vals.push(data.screenshot_mobile);
  }
  if (data.lighthouse_score !== undefined) {
    sets.push("lighthouse_score = ?");
    vals.push(data.lighthouse_score);
  }
  if (data.pain_score !== undefined) {
    sets.push("pain_score = ?");
    vals.push(data.pain_score);
  }
  if (data.siteforge_fit_score !== undefined) {
    sets.push("siteforge_fit_score = ?");
    vals.push(data.siteforge_fit_score);
  }
  if (data.fit_status !== undefined) {
    sets.push("fit_status = ?");
    vals.push(data.fit_status);
  }
  if (data.disqualified_reason !== undefined) {
    sets.push("disqualified_reason = ?");
    vals.push(data.disqualified_reason);
  }
  if (data.pain_points !== undefined) {
    sets.push("pain_points = ?");
    vals.push(Array.isArray(data.pain_points) ? JSON.stringify(data.pain_points) : data.pain_points);
  }

  if (sets.length === 0) return;

  sets.push("updated_at = datetime('now')");
  db.prepare(`UPDATE prospects SET ${sets.join(", ")} WHERE id = ?`).run(...vals, id);
}

export function listProspects(filters?: {
  status?: ProspectStatus;
  city?: string;
  minPainScore?: number;
  minFitScore?: number;
  fitStatus?: string;
}): Prospect[] {
  const db = getDb();
  const where: string[] = [];
  const vals: unknown[] = [];

  if (filters?.status) {
    where.push("status = ?");
    vals.push(filters.status);
  }
  if (filters?.city) {
    where.push("city = ?");
    vals.push(filters.city);
  }
  if (filters?.minPainScore !== undefined) {
    where.push("pain_score >= ?");
    vals.push(filters.minPainScore);
  }
  if (filters?.minFitScore !== undefined) {
    where.push("siteforge_fit_score >= ?");
    vals.push(filters.minFitScore);
  }
  if (filters?.fitStatus) {
    where.push("fit_status = ?");
    vals.push(filters.fitStatus);
  }

  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  return db
    .prepare(`SELECT * FROM prospects ${clause} ORDER BY COALESCE(siteforge_fit_score, 0) DESC, COALESCE(pain_score, 0) DESC`)
    .all(...vals) as Prospect[];
}

export function addInteraction(prospectId: number, type: InteractionType, content: string): Interaction {
  const db = getDb();
  const result = db
    .prepare("INSERT INTO interactions (prospect_id, type, content) VALUES (?, ?, ?)")
    .run(prospectId, type, content);

  return db.prepare("SELECT * FROM interactions WHERE id = ?").get(Number(result.lastInsertRowid)) as Interaction;
}

export function getInteractions(prospectId: number): Interaction[] {
  return getDb()
    .prepare("SELECT * FROM interactions WHERE prospect_id = ? ORDER BY created_at DESC")
    .all(prospectId) as Interaction[];
}

export function createClient(
  prospectId: number,
  data?: {
    repo_url?: string;
    domain?: string;
    staging_url?: string;
    contract_date?: string;
    monthly_price?: number;
    setup_price?: number;
  },
): Client {
  const db = getDb();

  updateProspectStatus(prospectId, "closed");

  const result = db
    .prepare(
      `INSERT INTO clients (prospect_id, repo_url, domain, staging_url, contract_date, monthly_price, setup_price)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      prospectId,
      data?.repo_url ?? null,
      data?.domain ?? null,
      data?.staging_url ?? null,
      data?.contract_date ?? null,
      data?.monthly_price ?? 99,
      data?.setup_price ?? 1200,
    );

  return db.prepare("SELECT * FROM clients WHERE id = ?").get(Number(result.lastInsertRowid)) as Client;
}

export function updateClientStatus(id: number, status: ClientStatus): void {
  getDb().prepare("UPDATE clients SET status = ? WHERE id = ?").run(status, id);

  if (status === "live") {
    const client = getDb().prepare("SELECT prospect_id FROM clients WHERE id = ?").get(id) as { prospect_id: number };
    updateProspectStatus(client.prospect_id, "active");
  }
}

export function listClients(status?: ClientStatus): Client[] {
  const db = getDb();
  if (status) {
    return db.prepare("SELECT * FROM clients WHERE status = ?").all(status) as Client[];
  }
  return db.prepare("SELECT * FROM clients").all() as Client[];
}

export function getPipelineStats(): Record<ProspectStatus, number> {
  const db = getDb();
  const rows = db
    .prepare("SELECT status, COUNT(*) as count FROM prospects GROUP BY status")
    .all() as { status: ProspectStatus; count: number }[];

  const stats: Record<string, number> = {
    found: 0,
    qualified: 0,
    disqualified: 0,
    contacted: 0,
    warm: 0,
    demo: 0,
    closed: 0,
    active: 0,
  };

  for (const row of rows) stats[row.status] = row.count;
  return stats as Record<ProspectStatus, number>;
}
