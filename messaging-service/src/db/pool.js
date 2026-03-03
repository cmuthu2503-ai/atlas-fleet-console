const { Pool } = require('pg');
const config = require('../config');

let pool;

function getPool() {
  if (!pool) {
    pool = new Pool({ connectionString: config.database.url });
  }
  return pool;
}

async function query(text, params) {
  return getPool().query(text, params);
}

async function getClient() {
  return getPool().connect();
}

module.exports = { getPool, query, getClient };
