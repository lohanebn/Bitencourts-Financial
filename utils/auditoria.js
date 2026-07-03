const AuditoriaModel = require('../models/auditoriaModel');

function extrairUsuarioNome(req) {
  return req?.usuario?.nome || req?.usuario_nome || null;
}

function extrairUsuarioId(req) {
  return req?.auth?.usuarioId || req?.usuario_id || req?.usuario?.id || null;
}

async function registrarAcao(req, tipoAcao, descricao, detalhes = null) {
  try {
    const usuarioId = extrairUsuarioId(req);
    const usuarioNome = extrairUsuarioNome(req);
    await AuditoriaModel.registrar({
      usuario_id: usuarioId,
      usuario_nome: usuarioNome,
      tipo_acao: tipoAcao,
      descricao,
      detalhes
    });
  } catch (err) {
    console.error('Falha ao registrar auditoria:', err.message);
  }
}

module.exports = { registrarAcao };
