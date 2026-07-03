// =====================================================================
// BITENCOURT'S FINANCIAL - SERVIDOR PRINCIPAL
// =====================================================================
const express = require('express');
const path = require('path');
require('dotenv').config();

const { rotaNaoEncontrada, tratadorDeErros } = require('./middleware/errorHandler');
const autenticar = require('./middleware/auth');
const migrar = require('./config/migrate');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares globais
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// =====================================================================
// ROTAS DA API
// =====================================================================
app.use('/api', (req, res, next) => {
  const rotaPublica = req.path === '/auth/login' || req.path === '/auth/trocar-senha';
  if (rotaPublica) return next();
  return autenticar(req, res, next);
});
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/usuarios', require('./routes/usuarioRoutes'));
app.use('/api/receitas', require('./routes/receitaRoutes'));
app.use('/api/despesas', require('./routes/despesaRoutes'));
app.use('/api/cartoes', require('./routes/cartaoRoutes'));
app.use('/api/parcelamentos', require('./routes/parcelamentoRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/projecao', require('./routes/projecaoRoutes'));
app.use('/api/pagamentos', require('./routes/pagamentoRoutes'));
app.use('/api/auditoria', require('./routes/auditoriaRoutes'));


// Rota principal (SPA - Single Page Application)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Middlewares de erro (devem ser os últimos)
app.use(rotaNaoEncontrada);
app.use(tratadorDeErros);

async function iniciar() {
  try {
    await migrar();
    app.listen(PORT, () => {
      console.log('=================================================');
      console.log("  Bitencourt's Financial");
      console.log(`  Servidor rodando em: http://localhost:${PORT}`);
      console.log('=================================================');
    });
  } catch (err) {
    console.error('Erro ao atualizar a estrutura do banco:', err.message);
    process.exitCode = 1;
  }
}
iniciar();
