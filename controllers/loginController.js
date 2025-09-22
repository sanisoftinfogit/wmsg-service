const { loginUser,updateAdminPassword} = require('../services/loginService');

async function handleLogin(req, res) {
  const { username, password } = req.body;

  try {
    const result = await loginUser(username, password);

    if (result.loginDetails.length > 0) {
      res.json({
        success: true,
        loginDetails: result.loginDetails[0],   
        mobileDetails: result.mobileDetails   
      });
    } else {
      res.status(401).json({ success: false, message: "Invalid credentials" });
    }
  } catch (err) {
    console.error("❌ Error in controller:", err);
    res.status(500).json({ success: false, message: "Database error" });
  }
}
async function handleUpdatePassword(req, res) {
  const { username, oldPassword, newPassword } = req.body;

  if (!username || !oldPassword || !newPassword) {
    return res.status(400).json({ success: false, message: "All fields required" });
  }

  try {
    const resultCode = await updateAdminPassword(username, oldPassword, newPassword);

    if (resultCode === 1) {
      res.json({ success: true, message: "Password updated successfully" });
    } else if (resultCode === 2) {
      res.status(401).json({ success: false, message: "Invalid old password" });
    } else {
      res.status(500).json({ success: false, message: "Unknown error" });
    }
  } catch (err) {
    console.error("❌ Error in controller:", err);
    res.status(500).json({ success: false, message: "Database error" });
  }
}
module.exports = { handleLogin,handleUpdatePassword };