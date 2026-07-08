// =====================================================================
// CONFIGURAÇÃO DE CONEXÃO COM O BANCO DE DADOS MYSQL
// =====================================================================
const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'bitencourts_financial',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true // retorna DATE/DATETIME como string (evita problemas de timezone)
});

// Servidores de hospedagem (ex.: Render) costumam rodar o MySQL com o relógio em UTC,
// enquanto o app é usado só no horário de Brasília. Sem isto, CURRENT_TIMESTAMP/NOW()
// gravam 3h à frente do horário real. Brasil não tem horário de verão desde 2019,
// então o offset fixo "-03:00" é sempre correto (não depende das tabelas de fuso do MySQL).
pool.on('connection', (conexao) => {
  conexao.query("SET time_zone = '-03:00'");
});

// Testa a conexão ao iniciar
async function testarConexao() {
  try {
    const conn = await pool.getConnection();
    console.log('✅ Conexão com o MySQL estabelecida com sucesso.');
    conn.release();
  } catch (err) {
    console.error('❌ Erro ao conectar com o MySQL:', err.message);
    console.error('   Verifique se o MySQL está rodando e se o arquivo .env está configurado corretamente.');
  }
}

testarConexao();

module.exports = pool;
