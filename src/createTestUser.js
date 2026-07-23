require("dotenv").config();

const bcrypt = require("bcrypt");

const db = require("./database");

async function createTestUser() {
  const email = "ci-test@example.com";
  const password = "CI_Test_Password_123!";
  const name = "CI Test User";

  try {
    const passwordHash = await bcrypt.hash(password, 12);

    await db.execute(
      `
      INSERT INTO users
        (
          email,
          password_hash,
          name,
          role,
          status
        )
      VALUES
        (?, ?, ?, 'driver', 'active')
      `,
      [email, passwordHash, name],
    );

    console.log("Test user created successfully");
  } catch (error) {
    console.error("Failed to create test user:", error);

    process.exit(1);
  } finally {
    await db.end();
  }
}

createTestUser();
