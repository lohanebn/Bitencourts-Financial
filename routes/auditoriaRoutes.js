// =====================================================================
// ROTAS: Auditoria / Linha do Tempo
// =====================================================================
const express = require('express');
const router = express.Router();
const AuditoriaController = require('../controllers/auditoriaController');

router.get('/', AuditoriaController.listar);

module.exports = router;
