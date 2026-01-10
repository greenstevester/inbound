/**
 * Creates a local development API key directly using Better Auth server API
 * Run with: bun run scripts/create-local-dev-apikey.ts
 */

import { auth } from "../lib/auth/auth";
import { db } from "../lib/db";
import { eq } from "drizzle-orm";
import * as schema from "../lib/db/schema";

async function createLocalDevApiKey() {
  console.log("🔧 Creating local development API key...\n");

  const userId = "usr_local_dev_001";
  const email = "dev@thepetpanicbutton.com";

  // Check if user exists
  const existingUser = await db
    .select()
    .from(schema.user)
    .where(eq(schema.user.id, userId))
    .limit(1);

  if (existingUser.length === 0) {
    console.log("📝 Creating user...");
    await db.insert(schema.user).values({
      id: userId,
      email: email,
      name: "Local Dev User",
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log("✅ User created:", email);
  } else {
    console.log("✅ User already exists:", email);
  }

  // Create API key using Better Auth
  console.log("\n📝 Creating API key...");

  try {
    const result = await auth.api.createApiKey({
      body: {
        name: "pet-panic-local-dev",
        expiresIn: 60 * 60 * 24 * 365, // 1 year in seconds
        userId: userId,
      },
    });

    console.log("\n" + "=".repeat(60));
    console.log("✅ API KEY CREATED SUCCESSFULLY!");
    console.log("=".repeat(60));
    console.log("\n🔑 Your API Key (save this, shown only once!):\n");
    console.log(`   ${result.key}`);
    console.log("\n" + "=".repeat(60));
    console.log("\n📋 Add to your .env or thepetpanicbutton/.env:");
    console.log(`\n   INBOUND_API_KEY=${result.key}`);
    console.log("   INBOUND_BASE_URL=http://localhost:3000");
    console.log("\n" + "=".repeat(60));
  } catch (error) {
    console.error("❌ Error creating API key:", error);
    process.exit(1);
  }
}

createLocalDevApiKey()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
