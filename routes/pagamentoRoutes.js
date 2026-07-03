const express = require('express');
const router = express.Router();
const controller = require('../controllers/pagamentoController');
router.get('/historico', controller.listarHistorico);
router.get('/', controller.listar);
router.post('/cartao-fatura', controller.pagarFatura);
router.post('/', controller.registrar);
router.delete('/:id', controller.estornar);
module.exports = router;
