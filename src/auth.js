const bcrypt = require("bcrypt");

const db = require("./database");

const {
  generateAccessToken,
  generateRefreshToken,
} = require("./jwt");


const SALT_ROUNDS = 12;


/*
 * LOGOWANIE
 */
async function loginUser(email, password) {

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
    [email]
  );


  if (users.length === 0) {
    throw new Error("Nieprawidłowy email lub hasło");
  }


  const user = users[0];


  if (user.status !== "active") {
    throw new Error("Konto nie jest aktywne");
  }


  const passwordValid = await bcrypt.compare(
    password,
    user.password_hash
  );


  if (!passwordValid) {
    throw new Error("Nieprawidłowy email lub hasło");
  }


  const accessToken = generateAccessToken(user);

  const refreshToken = generateRefreshToken(user);


  return {
    accessToken,
    refreshToken,

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
  SALT_ROUNDS,
};