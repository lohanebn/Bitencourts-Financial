-- =====================================================================
-- BITENCOURT'S FINANCIAL - MIGRAÇÃO V2
-- Despesas Fixas Recorrentes + Obrigações Parceladas Genéricas
-- =====================================================================
-- Este script é ADITIVO: não remove nem altera dados existentes.
-- Execute-o em um banco já criado pelo schema.sql original.
-- Pode ser executado em segurança mesmo que já tenha dados de produção.
-- =====================================================================

USE bitencourts_financial;

-- =====================================================================
-- 1. DESPESAS FIXAS RECORRENTES
-- =====================================================================
-- Novas colunas opcionais em "despesas". Toda despesa já existente
-- continua funcionando exatamente como antes (eh_recorrente = 0).
-- Quando uma despesa recorrente gera ocorrências futuras, cada
-- ocorrência é uma LINHA NORMAL em "despesas" (mesma estrutura de
-- sempre), apenas marcada com despesa_origem_id apontando para o
-- lançamento "modelo" que originou a série.

ALTER TABLE despesas
  ADD COLUMN eh_recorrente TINYINT(1) NOT NULL DEFAULT 0 AFTER tipo,
  ADD COLUMN dia_vencimento TINYINT NULL AFTER eh_recorrente,
  ADD COLUMN periodicidade ENUM('Mensal','Bimestral','Trimestral','Semestral','Anual') NULL AFTER dia_vencimento,
  ADD COLUMN duracao_tipo ENUM('Indeterminada','Quantidade') NULL AFTER periodicidade,
  ADD COLUMN qtd_ocorrencias SMALLINT NULL AFTER duracao_tipo,
  ADD COLUMN despesa_origem_id INT NULL AFTER qtd_ocorrencias,
  ADD CONSTRAINT chk_despesas_dia_vencimento CHECK (dia_vencimento IS NULL OR dia_vencimento BETWEEN 1 AND 31),
  ADD CONSTRAINT chk_despesas_qtd_ocorrencias CHECK (qtd_ocorrencias IS NULL OR qtd_ocorrencias > 0),
  ADD CONSTRAINT fk_despesas_origem FOREIGN KEY (despesa_origem_id) REFERENCES despesas(id)
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX idx_despesas_origem ON despesas(despesa_origem_id);
CREATE INDEX idx_despesas_recorrente ON despesas(eh_recorrente);

-- =====================================================================
-- 2 e 3. OBRIGAÇÕES PARCELADAS GENÉRICAS
-- =====================================================================
-- "parcelamentos" passa a representar qualquer obrigação parcelada,
-- não apenas compras no cartão. cartao_id deixa de ser obrigatório
-- (continua existindo e funcionando normalmente para o tipo
-- "Cartão de Crédito"). Os parcelamentos já cadastrados recebem
-- tipo_obrigacao = 'Cartão de Crédito' automaticamente, preservando
-- 100% o comportamento e os dados atuais.

ALTER TABLE parcelamentos
  MODIFY COLUMN cartao_id INT NULL,
  ADD COLUMN tipo_obrigacao ENUM(
    'Cartão de Crédito','Empréstimo','Financiamento','Consórcio',
    'Boleto Parcelado','Acordo de Dívida','Outro'
  ) NOT NULL DEFAULT 'Cartão de Crédito' AFTER cartao_id,
  ADD COLUMN responsavel_texto VARCHAR(150) NULL AFTER tipo_obrigacao,
  ADD COLUMN data_primeiro_vencimento DATE NULL AFTER data_compra;

-- Preenche o tipo dos parcelamentos já existentes (todos eram de cartão)
UPDATE parcelamentos SET tipo_obrigacao = 'Cartão de Crédito' WHERE cartao_id IS NOT NULL;

CREATE INDEX idx_parcelamentos_tipo ON parcelamentos(tipo_obrigacao);

-- =====================================================================
-- 4. PESSOA RESPONSÁVEL NA PARCELA INDIVIDUAL
-- =====================================================================
-- Hoje a pessoa responsável é obtida via parcelamentos.usuario_id.
-- Adicionamos a coluna diretamente na parcela (populada a partir do
-- parcelamento pai) para atender ao requisito de cada parcela ter sua
-- própria referência de pessoa responsável, sem alterar o
-- funcionamento de parcelas já existentes.

ALTER TABLE parcelas
  ADD COLUMN usuario_id INT NULL AFTER parcelamento_id,
  ADD CONSTRAINT fk_parcelas_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Popula a pessoa responsável das parcelas já existentes, a partir do parcelamento pai
UPDATE parcelas p
INNER JOIN parcelamentos pm ON pm.id = p.parcelamento_id
SET p.usuario_id = pm.usuario_id
WHERE p.usuario_id IS NULL;

CREATE INDEX idx_parcelas_usuario ON parcelas(usuario_id);

-- =====================================================================
-- FIM DA MIGRAÇÃO V2
-- =====================================================================
