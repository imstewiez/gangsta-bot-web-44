-- Adiciona tipo de prémio à tabela weekly_prizes
-- A chefia escolhe o que é dado (Casa, Arma, Carro, Dinheiro, Outro)
-- O vencedor é calculado automaticamente pelo sistema

alter table weekly_prizes add column if not exists prize_type text;
