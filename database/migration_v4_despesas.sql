-- Remove a data de pagamento da entidade despesa.
-- As baixas continuam auditadas na tabela pagamentos.
USE bitencourts_financial;

INSERT IGNORE INTO despesa_rateios (despesa_id, usuario_id, percentual, valor)
SELECT d.id, u.id, 50.00, ROUND(d.valor / 2, 2)
FROM despesas d
JOIN (SELECT id FROM usuarios ORDER BY id LIMIT 2) u
WHERE d.tipo = 'Fixa';

UPDATE despesas
SET usuario_id = NULL, rateada = 1
WHERE tipo = 'Fixa';

ALTER TABLE despesas DROP COLUMN data_pagamento;
