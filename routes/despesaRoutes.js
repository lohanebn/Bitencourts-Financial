// =====================================================================
// ROTAS: Despesas
// =====================================================================
const express = require('express');
const router = express.Router();
const DespesaController = require('../controllers/despesaController');

router.get('/', DespesaController.listar);
router.get('/:id', DespesaController.buscar);
router.post('/', DespesaController.criar);
router.delete('/lote', DespesaController.excluirEmLote);
router.put('/:id', DespesaController.atualizar);
router.delete('/:id', DespesaController.excluir);

module.exports = router;
