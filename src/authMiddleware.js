const { verifyAccessToken } = require("./jwt");

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      status: "ERROR",
      message: "Brak tokenu autoryzacyjnego",
    });
  }

  const parts = authHeader.split(" ");

  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return res.status(401).json({
      status: "ERROR",
      message: "Nieprawidłowy format tokenu",
    });
  }

  const token = parts[1];

  try {
    const decoded = verifyAccessToken(token);

    req.user = decoded;

    next();
  } catch (error) {
    return res.status(401).json({
      status: "ERROR",
      message: "Token jest nieprawidłowy lub wygasł",
    });
  }
}

module.exports = {
  authenticateToken,
};
