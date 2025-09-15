const { sql, getConnection } = require('../config/db');

async function loginUser(username, password) {
  try {
    let pool = await getConnection();

    let result = await pool.request()
      .input('Action', sql.VarChar, 'SelectLogin')
      .input('username', sql.VarChar, username)
      .input('password', sql.VarChar, password)
      .execute('saniszu9_1.sp_login'); 


    return {
      loginDetails: result.recordsets[0] || [],  
      mobileDetails: result.recordsets[1] || []  
    };

  } catch (err) {
    throw err;
  }
}

module.exports = { loginUser };
