const bcrypt = require("bcrypt");

const db = require("./database");
const { generateToken } = require("./jwt");

async function loginUser(email, password) {
  if (!email || !password) {
    throw new Error("Email i hasło są wymagane");
  }

  const [users] = await db.query(
    `
    SELECT
      id,
      email,
      password_hash,
      name,
      role,
      status
    FROM users
    WHERE email = ?
    LIMIT 1
    `,
    [email],
  );

  if (users.length === 0) {
    throw new Error("Nieprawidłowy email lub hasło");
  }

  const user = users[0];

  if (user.status !== "active") {
    throw new Error("Konto jest nieaktywne");
  }

  const passwordValid = await bcrypt.compare(password, user.password_hash);

  if (!passwordValid) {
    throw new Error("Nieprawidłowy email lub hasło");
  }

  const token = generateToken(user);

  return {
    token,

    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  };
}

module.exports = {
  loginUser,
};
