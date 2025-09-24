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

// async function insertMsgSchedule({ login_id, mobile, jid, msdate, medate, mtime }) {
//   try {
//     let pool = await getConnection();

//     let result = await pool.request()
//       .input('Action', sql.NVarChar(100), 'InsertMSGSchedule')
//       .input('login_id', sql.VarChar(20), login_id)
//       .input('mobile', sql.VarChar(20), mobile)
//       .input('jid', sql.VarChar(50), jid)
//       .input('msdate', sql.Date, msdate)   // startDate
//       .input('medate', sql.Date, medate)   // endDate
//       .input('mtime', sql.VarChar(10), mtime) // HH:mm:ss
//       .output('Result', sql.Int)
//       .execute('saniszu9_1.sp_wmsg');

//     return result.output.Result;
//   } catch (err) {
//     console.error("❌ Error in insertMSGSchedule:", err);
//     throw err;
//   }
// }
async function insertMSGSchedule({ login_id, mobile, jid, msdate, medate, mtime }) {
  try {
    let pool = await getConnection();

    let result = await pool.request()
      .input('Action', sql.NVarChar(100), 'InsertMSGSchedule')
      .input('login_id', sql.VarChar(20), login_id)
      .input('mobile', sql.VarChar(20), mobile)
      .input('jid', sql.Int, jid)   // jid generated in backend
      .input('msdate', sql.Date, msdate)
      .input('medate', sql.Date, medate)
      .input('mtime', sql.NVarChar(20), mtime)
      .output('Result', sql.Int)
      .execute('saniszu9_1.sp_wmsg');

    return result.output.Result;
  } catch (err) {
    console.error("❌ Error in insertMSGSchedule:", err);
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

async function listMSGSchedules() {
  try {
    const pool = await getConnection();

    const result = await pool.request()
      .input('Action', sql.NVarChar(50), 'ListMSGSchedule')
      .execute('saniszu9_1.sp_wmsg');

    return result.recordset; // array of scheduled messages
  } catch (err) {
    console.error("❌ Error in listMSGSchedules:", err);
    throw err;
  }
}


async function execSP(spName, inputParams = {}) {
  try {
    const pool = await getConnection(); // 🔹 connection pool मिळवा
    const request = pool.request();     // 🔹 SP call करण्यासाठी request तयार करा

    for (const key in inputParams) {
      const value = inputParams[key];
      request.input(key, value);
    }

    const result = await request.execute(spName);
    return result.recordset || result;
  } catch (err) {
    console.error("❌ execSP error:", err);
    throw err;
  }
}




module.exports = { insertMobileRegistration,deleteSession,insertGroup, updateGroup,getGroupsByLoginId,getGroupNumbersByGroupId,insertMSGSchedule,listMSGSchedules,execSP};
