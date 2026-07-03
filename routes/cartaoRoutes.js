// =====================================================================
// ROTAS: Cartões
// =====================================================================
const express = require('express');
const router = express.Router();
const CartaoController = require('../controllers/cartaoController');

router.get('/', CartaoController.listar);
router.get('/:id/fatura', CartaoController.listarFatura);
router.get('/:id', CartaoController.buscar);
router.post('/', CartaoController.criar);
router.put('/:id', CartaoController.atualizar);
router.delete('/:id', CartaoController.excluir);

module.exports = router;
