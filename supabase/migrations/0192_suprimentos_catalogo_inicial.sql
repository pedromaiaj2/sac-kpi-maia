-- Catálogo inicial de Suprimentos -- pedido do Victor 21/10/2026: lista de
-- itens administrativos/limpeza que as lojas pedem com frequência, pra não
-- precisar cadastrar um por um pela tela de admin. "Grampeador" entrava
-- duas vezes na lista original (uma com erro de digitação) -- cadastrado
-- uma única vez.

insert into suprimento_produtos (nome, categoria, unidade) values
  ('Resma de papel A4', 'Escritório', 'resma'),
  ('Caixa de bobina para impressora fiscal', 'Escritório', 'cx'),
  ('Caneta', 'Escritório', 'un'),
  ('Sacola de acessórios P/M/G/GG', 'Loja', 'un'),
  ('Desinfetante', 'Limpeza', 'un'),
  ('Detergente', 'Limpeza', 'un'),
  ('Sabão em pó', 'Limpeza', 'un'),
  ('Água sanitária', 'Limpeza', 'un'),
  ('Papel higiênico', 'Limpeza', 'fardo'),
  ('Copo descartável', 'Loja', 'pct'),
  ('Saco de lixo médio', 'Limpeza', 'pct'),
  ('Saco de lixo grande', 'Limpeza', 'pct'),
  ('Álcool', 'Limpeza', 'un'),
  ('Multiuso', 'Limpeza', 'un'),
  ('Flanela', 'Limpeza', 'un'),
  ('Pano de chão', 'Limpeza', 'un'),
  ('Espanador', 'Limpeza', 'un'),
  ('Lustra móveis', 'Limpeza', 'un'),
  ('Fita lacre', 'Escritório', 'un'),
  ('Grampeador', 'Escritório', 'un'),
  ('Calculadora', 'Escritório', 'un'),
  ('Caixa de grampo', 'Escritório', 'cx'),
  ('Marca texto', 'Escritório', 'un'),
  ('Marcador permanente', 'Escritório', 'un')
on conflict (nome) do nothing;
