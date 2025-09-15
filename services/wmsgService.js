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

    return result.output.Result;
  } catch (err) {
    console.error("❌ Error in WMSG Service:", err);
    throw err;
  }
}

async function deleteSession({ mobile, login_id }) {
  try {
    let pool = await getConnection();

    let result = await pool.request()
      .input('Action', sql.NVarChar(100), 'DeleteSession')
      .input('mobile', sql.VarChar(20), mobile)
      .input('login_id', sql.VarChar(20), login_id)
      .output('Result', sql.Int)
      .execute('saniszu9_1.sp_wmsg');

    return result.output.Result; 
  } catch (err) {
    console.error("❌ Error in deleteSession Service:", err);
    throw err;
  }
}

async function insertGroup({ login_id, group_name, numbers }) {
  try {
    let pool = await getConnection();

    
    const tvp = new sql.Table();
    tvp.columns.add('name', sql.NVarChar(100));
    tvp.columns.add('number', sql.VarChar(20));

    numbers.forEach(n => {
      tvp.rows.add(n.name, n.number);
    });

    let result = await pool.request()
      .input('Action', sql.NVarChar(50), 'InsertGroup')
      .input('login_id', sql.VarChar(50), login_id)
      .input('group_name', sql.NVarChar(200), group_name)
      .input('TempNumbers', tvp) 
      .output('Result', sql.Int)
      .execute('saniszu9_1.sp_wmsg');

    return result.output.Result; 
  } catch (err) {
    console.error("❌ insertGroup Service error:", err);
    throw err;
  }
}

async function updateGroup({ id, group_id, group_name, numbers }) {
  try {
    let pool = await getConnection();

    const tvp = new sql.Table();
    tvp.columns.add('name', sql.NVarChar(100));
    tvp.columns.add('number', sql.VarChar(20));

    numbers.forEach(n => {
      tvp.rows.add(n.name, n.number);
    });

    let result = await pool.request()
      .input('Action', sql.NVarChar(50), 'UpdateGroup')
      .input('id', sql.Int, id)
      .input('group_id', sql.Int, group_id)
      .input('group_name', sql.NVarChar(200), group_name)
      .input('TempNumbers', tvp)
      .output('Result', sql.Int)
      .execute('saniszu9_1.sp_wmsg');

    return result.output.Result;
  } catch (err) {
    console.error("❌ updateGroup Service error:", err);
    throw err;
  }
}

async function getGroupsByLoginId(login_id) {
  try {
    let pool = await getConnection();

    let result = await pool.request()
      .input("Action", sql.NVarChar(50), "SelectGroupListByLoginID")
      .input("login_id", sql.NVarChar(50), login_id)
      .execute("saniszu9_1.sp_wmsg");

    return result.recordset; 
  } catch (err) {
    console.error("❌ Error in getGroupsByLoginId:", err);
    throw err;
  }
}

async function getGroupNumbersByGroupId(group_id) {
  try {
    let pool = await getConnection();

    let result = await pool.request()
      .input("Action", sql.NVarChar(50), "SelectGroupNumbersByGroupID")
      .input("group_id", sql.Int, group_id)
      .execute("saniszu9_1.sp_wmsg");

    return result.recordset;
  } catch (err) {
    console.error("❌ Error in getGroupNumbersByGroupId:", err);
    throw err;
  }
}



module.exports = { insertMobileRegistration,deleteSession,insertGroup, updateGroup,getGroupsByLoginId,getGroupNumbersByGroupId };
