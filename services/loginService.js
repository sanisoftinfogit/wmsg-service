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

async function updateAdminPassword(username, oldPassword, newPassword) {
  try {
    let pool = await getConnection();

    let result = await pool.request()
      .input('Action', sql.VarChar, 'UpdateAdminPassword')
      .input('username', sql.VarChar, username)
      .input('password', sql.VarChar, oldPassword)
      .input('newpassword', sql.VarChar, newPassword)
      .output('Result', sql.Int)
      .execute('saniszu9_1.sp_login'); 

    // get Result value
    const resCode = result.output.Result;

    return resCode; // 1 = success, 2 = invalid old password
  } catch (err) {
    throw err;
  }
}



module.exports = { loginUser,updateAdminPassword };
