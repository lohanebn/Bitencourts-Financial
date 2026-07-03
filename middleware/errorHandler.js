// =====================================================================
// MIDDLEWARE: Tratamento de Erros
// =====================================================================

// Middleware para rotas não encontradas (404)
function rotaNaoEncontrada(req, res, next) {
  if (req.path === '/favicon.ico') return res.status(204).end();
  res.status(404).json({
    sucesso: false,
    mensagem: `Rota não encontrada: ${req.method} ${req.originalUrl}`
  });
}

// Middleware global de tratamento de erros
function tratadorDeErros(err, req, res, next) {
  console.error('Erro não tratado:', err);
  res.status(err.status || 500).json({
    sucesso: false,
    mensagem: 'Ocorreu um erro interno no servidor.',
    erro: process.env.NODE_ENV === 'production' ? undefined : err.message
  });
}

module.exports = { rotaNaoEncontrada, tratadorDeErros };
