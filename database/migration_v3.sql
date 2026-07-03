-- BITENCOURT'S FINANCIAL - MIGRAÇÃO V3
-- Execute após migration_v2.sql. Aditiva e compatível com dados existentes.
USE bitencourts_financial;

ALTER TABLE despesas MODIFY usuario_id INT NULL;
ALTER TABLE despesas
  ADD COLUMN rateada TINYINT(1) NOT NULL DEFAULT 0 AFTER usuario_id,
  ADD COLUMN valor_pago DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER valor;

CREATE TABLE despesa_rateios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  despesa_id INT NOT NULL,
  usuario_id INT NOT NULL,
  percentual DECIMAL(5,2) NOT NULL DEFAULT 50.00,
  valor DECIMAL(12,2) NOT NULL,
  UNIQUE KEY uk_rateio_despesa_usuario (despesa_id, usuario_id),
  CONSTRAINT fk_rateio_despesa FOREIGN KEY (despesa_id) REFERENCES despesas(id) ON DELETE CASCADE,
  CONSTRAINT fk_rateio_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

ALTER TABLE parcelas
  ADD COLUMN valor_pago DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER valor,
  ADD COLUMN data_pagamento DATE NULL AFTER data_vencimento;

CREATE TABLE pagamentos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  origem_tipo ENUM('Despesa','Parcela') NOT NULL,
  origem_id INT NOT NULL,
  valor_devido DECIMAL(12,2) NOT NULL,
  valor_pago DECIMAL(12,2) NOT NULL,
  credito_gerado DECIMAL(12,2) NOT NULL DEFAULT 0,
  data_pagamento DATE NOT NULL,
  observacao TEXT NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_pagamentos_origem (origem_tipo, origem_id),
  INDEX idx_pagamentos_data (data_pagamento)
) ENGINE=InnoDB;

