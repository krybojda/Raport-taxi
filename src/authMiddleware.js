const { verifyToken } = require("./jwt");

function authenticateToken(req, res, next) {
  const token = req.cookies?.auth_token;

  if (!token) {
    return res.status(401).json({
      status: "ERROR",
      message: "Brak tokenu autoryzacyjnego",
    });
  }

  try {
    const decoded = verifyToken(token);

    req.user = decoded;

    next();
  } catch (error) {
    console.error("JWT error:", error.message);

    return res.status(401).json({
      status: "ERROR",
      message: "Nieprawidłowy lub wygasły token",
    });
  }
}

module.exports = {
  authenticateToken,
};
