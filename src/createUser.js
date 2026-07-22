require("dotenv").config();

const crypto = require("crypto");
const bcrypt = require("bcrypt");

const db = require("./database");

const SALT_ROUNDS = 12;

async function createUser() {
  const email = process.argv[2];
  const name = process.argv[3];

  if (!email || !name) {
    console.error("Użycie: node src/createUser.js email name");

    process.exit(1);
  }

  try {
    // Generowanie losowego hasła
    const temporaryPassword = crypto.randomBytes(12).toString("base64url");

    // Hashowanie hasła
    const passwordHash = await bcrypt.hash(temporaryPassword, SALT_ROUNDS);

    // Utworzenie użytkownika
    const [result] = await db.query(
      `
      INSERT INTO users
        (email, password_hash, name, role, status)
      VALUES
        (?, ?, ?, 'driver', 'active')
      `,
      [email, passwordHash, name],
    );

    console.log("");
    console.log("Użytkownik został utworzony.");
    console.log("");
    console.log(`ID:       ${result.insertId}`);
    console.log(`Email:    ${email}`);
    console.log(`Nazwa:     ${name}`);
    console.log(`Rola:      driver`);
    console.log(`Status:    active`);
    console.log("");
    console.log("HASŁO TYMCZASOWE:");
    console.log(temporaryPassword);
    console.log("");
    console.log("Przekaż hasło użytkownikowi.");
    console.log("Po wdrożeniu zmiany hasła użytkownik powinien je zmienić.");
    console.log("");
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      console.error("Użytkownik z takim adresem email już istnieje.");
    } else {
      console.error("Błąd podczas tworzenia użytkownika:", error.message);
    }

    process.exit(1);
  } finally {
    await db.end();
  }
}

createUser();
