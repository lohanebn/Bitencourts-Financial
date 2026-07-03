// =====================================================================
// ROTAS: Dashboard
// =====================================================================
const express = require('express');
const router = express.Router();
const DashboardController = require('../controllers/dashboardV3Controller');

router.get('/', DashboardController.resumo);

module.exports = router;
