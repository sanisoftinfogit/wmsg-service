const { loginUser } = require('../services/loginService');

async function handleLogin(req, res) {
  const { username, password } = req.body;

  try {
    const result = await loginUser(username, password);

    if (result.loginDetails.length > 0) {
      res.json({
        success: true,
        loginDetails: result.loginDetails[0],   // single row (username, password, post)
        mobileDetails: result.mobileDetails     // list of mobiles
      });
    } else {
      res.status(401).json({ success: false, message: "Invalid credentials" });
    }
  } catch (err) {
    console.error("❌ Error in controller:", err);
    res.status(500).json({ success: false, message: "Database error" });
  }
}

module.exports = { handleLogin };