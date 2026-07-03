-- =====================================================================
-- MIGRATION v6: Cartões — suporte a responsável "Casal" (rateado 50/50)
-- =====================================================================

-- Torna usuario_id opcional (NULL = Casal)
ALTER TABLE cartoes DROP FOREIGN KEY fk_cartoes_usuario;
ALTER TABLE cartoes MODIFY COLUMN usuario_id INT NULL;
ALTER TABLE cartoes ADD CONSTRAINT fk_cartoes_usuario
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Campo rateado: 1 = responsabilidade dividida 50/50 entre os dois usuários
ALTER TABLE cartoes ADD COLUMN rateado TINYINT(1) NOT NULL DEFAULT 0 AFTER usuario_id;
