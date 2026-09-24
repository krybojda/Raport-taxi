require("dotenv").config();

const bcrypt = require("bcrypt");

const db = require("./database");

async function createTestUser() {
  const email = "ci-test@example.com";
  const password = "CI_Test_Password_123!";
  const name = "CI Test User";

  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role ENUM('driver', 'admin') NOT NULL DEFAULT 'driver',
        status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

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
      ON DUPLICATE KEY UPDATE
        password_hash = VALUES(password_hash),
        name = VALUES(name),
        role = VALUES(role),
        status = VALUES(status)
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
