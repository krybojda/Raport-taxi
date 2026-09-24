const bcrypt = require("bcrypt");

const db = require("./database");
const { generateToken } = require("./jwt");

async function loginUser(name, password) {
  if (!name || !password) {
    throw new Error("Nazwa użytkownika i hasło są wymagane");
  }

  const [users] = await db.execute(
    `
    SELECT
      id,
      email,
      password_hash,
      name,
      role,
      status
    FROM users
    WHERE name = ?
    LIMIT 1
    `,
    [name],
  );

  if (users.length === 0) {
    throw new Error("Nieprawidłowa nazwa użytkownika lub hasło");
  }

  const user = users[0];

  if (user.status !== "active") {
    throw new Error("Konto jest nieaktywne");
  }

  const passwordValid = await bcrypt.compare(password, user.password_hash);

  if (!passwordValid) {
    throw new Error("Nieprawidłowa nazwa użytkownika lub hasło");
  }

  const token = generateToken(user);

  return {
    token,

    user: {
      id: user.id,
      username: user.name,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  };
}

module.exports = {
  loginUser,
};
