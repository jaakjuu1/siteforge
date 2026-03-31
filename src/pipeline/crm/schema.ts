import Database from "better-sqlite3";

// --- Type definitions ---

export type ProspectStatus =
  | "found"
  | "qualified"
  | "disqualified"
  | "contacted"
  | "warm"
  | "demo"
  | "closed"
  | "active";

export type InteractionType = "email_sent" | "reply" | "call" | "note";

export type ClientStatus = "staging" | "live" | "churned" | "paused";

export interface Prospect {
  id: number;
  business_name: string;
  address: string | null;
  city: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  google_rating: number | null;
  review_count: number | null;
  screenshot_desktop: string | null;
  screenshot_mobile: string | null;
  lighthouse_score: number | null;
  pain_score: number | null;
  siteforge_fit_score: number | null;
  fit_status: string | null;
  disqualified_reason: string | null;
  pain_points: string | null; // JSON string
  status: ProspectStatus;
  created_at: string;
  updated_at: string;
}

export interface Interaction {
  id: number;
  prospect_id: number;
  type: InteractionType;
  content: string;
  created_at: string;
}

export interface Client {
  id: number;
  prospect_id: number;
  repo_url: string | null;
  domain: string | null;
  staging_url: string | null;
  contract_date: string | null;
  monthly_price: number;
  setup_price: number;
  status: ClientStatus;
  created_at: string;
}

// --- Schema creation ---

export function createTables(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS prospects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_name TEXT NOT NULL,
      address TEXT,
      city TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      website TEXT,
      google_rating REAL,
      review_count INTEGER,
      screenshot_desktop TEXT,
      screenshot_mobile TEXT,
      lighthouse_score REAL,
      pain_score REAL,
      siteforge_fit_score REAL,
      fit_status TEXT,
      disqualified_reason TEXT,
      pain_points TEXT,
      status TEXT NOT NULL DEFAULT 'found',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS interactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prospect_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (prospect_id) REFERENCES prospects(id)
    );

    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prospect_id INTEGER NOT NULL UNIQUE,
      repo_url TEXT,
      domain TEXT,
      staging_url TEXT,
      contract_date TEXT,
      monthly_price REAL NOT NULL DEFAULT 99,
      setup_price REAL NOT NULL DEFAULT 1200,
      status TEXT NOT NULL DEFAULT 'staging',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (prospect_id) REFERENCES prospects(id)
    );

    CREATE INDEX IF NOT EXISTS idx_prospects_status ON prospects(status);
    CREATE INDEX IF NOT EXISTS idx_prospects_city ON prospects(city);
    CREATE INDEX IF NOT EXISTS idx_interactions_prospect ON interactions(prospect_id);
  `);

  const columns = db.prepare("PRAGMA table_info(prospects)").all() as { name: string }[];
  const names = new Set(columns.map((c) => c.name));

  if (!names.has("siteforge_fit_score")) {
    db.exec("ALTER TABLE prospects ADD COLUMN siteforge_fit_score REAL");
  }
  if (!names.has("fit_status")) {
    db.exec("ALTER TABLE prospects ADD COLUMN fit_status TEXT");
  }
  if (!names.has("disqualified_reason")) {
    db.exec("ALTER TABLE prospects ADD COLUMN disqualified_reason TEXT");
  }
}
