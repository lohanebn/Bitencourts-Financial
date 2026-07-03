USE bitencourts_financial;

ALTER TABLE pagamentos
  ADD COLUMN descricao VARCHAR(150) NULL AFTER origem_id,
  ADD COLUMN origem VARCHAR(100) NULL AFTER descricao,
  ADD COLUMN responsavel VARCHAR(100) NULL AFTER origem;
