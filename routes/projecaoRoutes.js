// =====================================================================
// ROTAS: Projeção Financeira
// =====================================================================
const express = require('express');
const router = express.Router();
const ProjecaoController = require('../controllers/projecaoController');

router.get('/', ProjecaoController.projecao12Meses);

module.exports = router;
