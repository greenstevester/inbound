import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { neon } from "@neondatabase/serverless";
import pg from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const isLocalDb = process.env.DATABASE_URL.includes("localhost") ||
                  process.env.DATABASE_URL.includes("127.0.0.1");

// Use node-postgres for local development, Neon for production
export const db = isLocalDb
  ? drizzlePg(new pg.Pool({ connectionString: process.env.DATABASE_URL }))
  : drizzleNeon(neon(process.env.DATABASE_URL));