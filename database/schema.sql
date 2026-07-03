-- =====================================================================
-- BITENCOURT'S FINANCIAL - SCRIPT DE BANCO DE DADOS
-- Sistema de Controle Financeiro Pessoal para Casal/Duas Pessoas
-- =====================================================================

CREATE DATABASE IF NOT EXISTS bitencourts_financial
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE bitencourts_financial;

-- =====================================================================
-- TABELA: usuarios
-- =====================================================================
CREATE TABLE usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  cor VARCHAR(20) DEFAULT '#0d6efd',
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- =====================================================================
-- TABELA: receitas
-- =====================================================================
CREATE TABLE receitas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  descricao VARCHAR(150) NOT NULL,
  categoria ENUM('Salário','Freelance','Extra','Investimento','Outros') NOT NULL DEFAULT 'Outros',
  valor DECIMAL(12,2) NOT NULL,
  data_recebimento DATE NOT NULL,
  observacao TEXT,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_receitas_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT chk_receitas_valor CHECK (valor >= 0)
) ENGINE=InnoDB;

CREATE INDEX idx_receitas_data ON receitas(data_recebimento);
CREATE INDEX idx_receitas_usuario ON receitas(usuario_id);
CREATE INDEX idx_receitas_categoria ON receitas(categoria);

-- =====================================================================
-- TABELA: despesas
-- =====================================================================
CREATE TABLE despesas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  descricao VARCHAR(150) NOT NULL,
  categoria ENUM('Moradia','Energia','Água','Internet','Mercado','Transporte','Saúde','Educação','Lazer','Cartão','Outros') NOT NULL DEFAULT 'Outros',
  tipo ENUM('Fixa','Variável') NOT NULL DEFAULT 'Fixa',
  valor DECIMAL(12,2) NOT NULL,
  data_vencimento DATE NOT NULL,
  status ENUM('Pendente','Pago','Atrasado') NOT NULL DEFAULT 'Pendente',
  observacao TEXT,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_despesas_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT chk_despesas_valor CHECK (valor >= 0)
) ENGINE=InnoDB;

CREATE INDEX idx_despesas_vencimento ON despesas(data_vencimento);
CREATE INDEX idx_despesas_usuario ON despesas(usuario_id);
CREATE INDEX idx_despesas_status ON despesas(status);
CREATE INDEX idx_despesas_categoria ON despesas(categoria);

-- =====================================================================
-- TABELA: cartoes
-- =====================================================================
CREATE TABLE cartoes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  nome_cartao VARCHAR(100) NOT NULL,
  banco VARCHAR(100) NOT NULL,
  limite DECIMAL(12,2) NOT NULL DEFAULT 0,
  dia_fechamento TINYINT NOT NULL,
  dia_vencimento TINYINT NOT NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cartoes_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT chk_cartoes_fechamento CHECK (dia_fechamento BETWEEN 1 AND 31),
  CONSTRAINT chk_cartoes_vencimento CHECK (dia_vencimento BETWEEN 1 AND 31)
) ENGINE=InnoDB;

CREATE INDEX idx_cartoes_usuario ON cartoes(usuario_id);

-- =====================================================================
-- TABELA: parcelamentos
-- =====================================================================
CREATE TABLE parcelamentos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  cartao_id INT NOT NULL,
  descricao_compra VARCHAR(150) NOT NULL,
  categoria VARCHAR(100) NOT NULL DEFAULT 'Cartão',
  valor_total DECIMAL(12,2) NOT NULL,
  qtd_parcelas SMALLINT NOT NULL,
  valor_parcela DECIMAL(12,2) NOT NULL,
  data_compra DATE NOT NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_parcelamentos_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_parcelamentos_cartao FOREIGN KEY (cartao_id) REFERENCES cartoes(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT chk_parcelamentos_qtd CHECK (qtd_parcelas > 0),
  CONSTRAINT chk_parcelamentos_valor CHECK (valor_total >= 0)
) ENGINE=InnoDB;

CREATE INDEX idx_parcelamentos_usuario ON parcelamentos(usuario_id);
CREATE INDEX idx_parcelamentos_cartao ON parcelamentos(cartao_id);

-- =====================================================================
-- TABELA: parcelas
-- =====================================================================
CREATE TABLE parcelas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  parcelamento_id INT NOT NULL,
  numero_parcela SMALLINT NOT NULL,
  total_parcelas SMALLINT NOT NULL,
  valor DECIMAL(12,2) NOT NULL,
  data_vencimento DATE NOT NULL,
  status ENUM('Pendente','Pago') NOT NULL DEFAULT 'Pendente',
  CONSTRAINT fk_parcelas_parcelamento FOREIGN KEY (parcelamento_id) REFERENCES parcelamentos(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE INDEX idx_parcelas_parcelamento ON parcelas(parcelamento_id);
CREATE INDEX idx_parcelas_vencimento ON parcelas(data_vencimento);
CREATE INDEX idx_parcelas_status ON parcelas(status);

-- =====================================================================
-- DADOS FICTÍCIOS PARA DEMONSTRAÇÃO
-- =====================================================================

-- Usuários fixos
INSERT INTO usuarios (nome, cor) VALUES
('Lohane', '#0d6efd'),
('Parceira', '#d63384');

-- Receitas (mês atual e anterior, para os dois usuários)
INSERT INTO receitas (usuario_id, descricao, categoria, valor, data_recebimento, observacao) VALUES
(1, 'Salário Mensal', 'Salário', 5200.00, CURDATE() - INTERVAL DAY(CURDATE())-5 DAY, 'Salário fixo CLT'),
(1, 'Freelance Sistema Web', 'Freelance', 1300.00, CURDATE() - INTERVAL DAY(CURDATE())-15 DAY, 'Projeto extra de TI'),
(2, 'Salário Mensal', 'Salário', 3300.00, CURDATE() - INTERVAL DAY(CURDATE())-5 DAY, 'Salário fixo CLT'),
(2, 'Renda Extra - Vendas', 'Extra', 700.00, CURDATE() - INTERVAL DAY(CURDATE())-20 DAY, 'Vendas online'),
(1, 'Salário Mensal', 'Salário', 5200.00, CURDATE() - INTERVAL DAY(CURDATE())-5 DAY - INTERVAL 1 MONTH, 'Mês anterior'),
(2, 'Salário Mensal', 'Salário', 3300.00, CURDATE() - INTERVAL DAY(CURDATE())-5 DAY - INTERVAL 1 MONTH, 'Mês anterior');

-- Despesas fixas e variáveis (algumas pagas, pendentes e atrasadas)
INSERT INTO despesas (usuario_id, descricao, categoria, tipo, valor, data_vencimento, status, observacao) VALUES
  (1, 'Aluguel', 'Moradia', 'Fixa', 1800.00, CURDATE() - INTERVAL DAY(CURDATE())-10 DAY, 'Pago', 'Apartamento'),
  (1, 'Conta de Energia', 'Energia', 'Variável', 280.00, CURDATE() - INTERVAL DAY(CURDATE())-15 DAY, 'Pendente', NULL),
  (2, 'Internet + TV', 'Internet', 'Fixa', 150.00, CURDATE() - INTERVAL DAY(CURDATE())-12 DAY, 'Pago', NULL),
  (2, 'Supermercado', 'Mercado', 'Variável', 950.00, CURDATE() - INTERVAL DAY(CURDATE())-8 DAY, 'Pago', 'Compra do mês'),
  (1, 'Plano de Saúde', 'Saúde', 'Fixa', 420.00, CURDATE() - INTERVAL DAY(CURDATE())-20 DAY, 'Pendente', NULL),
  (2, 'Conta de Água', 'Água', 'Variável', 95.00, CURDATE() - INTERVAL DAY(CURDATE())-3 DAY, 'Atrasado', 'Vencida'),
  (1, 'Combustível', 'Transporte', 'Variável', 360.00, CURDATE() - INTERVAL DAY(CURDATE())-18 DAY, 'Pendente', NULL),
  (2, 'Curso Online', 'Educação', 'Fixa', 199.00, CURDATE() - INTERVAL DAY(CURDATE())-22 DAY, 'Pendente', NULL),
  (1, 'Cinema e Lazer', 'Lazer', 'Variável', 180.00, CURDATE() - INTERVAL DAY(CURDATE())-25 DAY, 'Pendente', NULL);

-- Cartões
INSERT INTO cartoes (usuario_id, nome_cartao, banco, limite, dia_fechamento, dia_vencimento) VALUES
(1, 'Cartão Gold', 'Itaú', 8000.00, 20, 28),
(2, 'Cartão Platinum', 'Nubank', 6000.00, 15, 25);

-- Parcelamentos (Notebook - exemplo do briefing - 12x de R$400)
INSERT INTO parcelamentos (usuario_id, cartao_id, descricao_compra, valor_total, qtd_parcelas, valor_parcela, data_compra) VALUES
(1, 1, 'Notebook Dell', 4800.00, 12, 400.00, CURDATE() - INTERVAL 2 MONTH),
(2, 2, 'Smartphone novo', 2400.00, 8, 300.00, CURDATE() - INTERVAL 1 MONTH);

-- Geração das parcelas do Notebook (12x), considerando que 2 já foram pagas (compra há 2 meses)
INSERT INTO parcelas (parcelamento_id, numero_parcela, total_parcelas, valor, data_vencimento, status)
SELECT
  1,
  n,
  12,
  400.00,
  DATE_ADD(CURDATE() - INTERVAL 2 MONTH, INTERVAL n MONTH),
  IF(n <= 2, 'Pago', 'Pendente')
FROM (SELECT 1 n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6
      UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION SELECT 10 UNION SELECT 11 UNION SELECT 12) nums;

-- Geração das parcelas do Smartphone (8x), considerando que 1 já foi paga (compra há 1 mês)
INSERT INTO parcelas (parcelamento_id, numero_parcela, total_parcelas, valor, data_vencimento, status)
SELECT
  2,
  n,
  8,
  300.00,
  DATE_ADD(CURDATE() - INTERVAL 1 MONTH, INTERVAL n MONTH),
  IF(n <= 1, 'Pago', 'Pendente')
FROM (SELECT 1 n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6
      UNION SELECT 7 UNION SELECT 8) nums;
