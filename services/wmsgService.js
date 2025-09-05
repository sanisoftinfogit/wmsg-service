const { sql, getConnection } = require('../config/db');

async function insertMobileRegistration({ mobile, userid, login_id, api_key }) {
  try {
    let pool = await getConnection();

    let result = await pool.request()
      .input('Action', sql.NVarChar(100), 'InsertMobileRegistration')
      .input('mobile', sql.VarChar(20), mobile)
      .input('userid', sql.NVarChar(30), userid)
      .input('login_id', sql.VarChar(20), login_id)
      .input('api_key', sql.NVarChar(100), api_key)
      .output('Result', sql.Int)
      .execute('saniszu9_1.sp_wmsg');

    return result.output.Result; // 1 = success, 0 = fail
  } catch (err) {
    console.error("❌ Error in WMSG Service:", err);
    throw err;
  }
}

module.exports = { insertMobileRegistration };
