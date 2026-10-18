-- Checkout PIX do Rotina Azul (PagBank, pedido com QR Code via API).
--
-- Como aplicar: Supabase > SQL Editor > cole este arquivo inteiro > Run.
-- É seguro rodar mais de uma vez.
--
-- Segurança: RLS ligado e SEM políticas em rotina_checkouts, então a chave
-- pública não lê nem escreve. Só as Edge Functions (service role) acessam.

-- ─── Intenção de compra: criada ANTES do PIX; o id vira o reference_id ───
create table if not exists public.rotina_checkouts (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  status              text not null default 'pendente'
                        check (status in ('pendente', 'pago', 'expirado', 'falhou')),
  nome                text not null,
  email               text not null,
  cpf                 text not null,
  codigo_ref          text,                 -- afiliada (pode ser nulo)
  valor_centavos      integer not null,     -- preço definido no servidor
  pagbank_order_id    text unique,
  pagbank_charge_id   text unique,          -- id da cobrança paga: idempotência
  qr_text             text,
  qr_png              text,
  expira_em           timestamptz not null,
  verificado_em       timestamptz,          -- última consulta ao PagBank
  pago_em             timestamptz,
  valor_pago_centavos integer,
  comissao_centavos   integer
);

create index if not exists rotina_checkouts_email_idx on public.rotina_checkouts (lower(email), created_at desc);
create index if not exists rotina_checkouts_cpf_idx on public.rotina_checkouts (cpf, created_at desc);

alter table public.rotina_checkouts enable row level security;

-- ─── Acesso do cliente: liberado por e-mail, 30 dias por pagamento ───
create table if not exists public.rotina_assinaturas (
  email         text primary key,           -- sempre em minúsculas
  ativa_ate     timestamptz not null,
  atualizado_em timestamptz not null default now()
);

alter table public.rotina_assinaturas enable row level security;

drop policy if exists "rotina_assinaturas_le_propria" on public.rotina_assinaturas;
create policy "rotina_assinaturas_le_propria" on public.rotina_assinaturas
  for select to authenticated
  using (email = lower(auth.jwt() ->> 'email'));

-- ─── Vendas de afiliadas: idempotência pelo id da cobrança do PagBank ───
-- As vendas antigas ficam com charge_id nulo, o que não conflita com o índice.
alter table public.affiliate_sales add column if not exists charge_id text;
create unique index if not exists affiliate_sales_charge_id_key on public.affiliate_sales (charge_id);

-- ─── Confirmação atômica e idempotente ───
-- Chamada pelas Edge Functions só depois de consultar o pedido na API do PagBank.
-- Retorna true na primeira confirmação e false se já estava paga.
create or replace function public.rotina_confirmar_pagamento(
  p_checkout       uuid,
  p_charge_id      text,
  p_valor_centavos integer,
  p_comissao_pct   numeric
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  c        public.rotina_checkouts;
  comissao integer;
begin
  -- Trava a linha: webhook e consulta simultâneos não confirmam duas vezes.
  select * into c from public.rotina_checkouts where id = p_checkout for update;
  if not found or c.status = 'pago' then
    return false;
  end if;
  if p_valor_centavos < c.valor_centavos then
    raise exception 'valor pago (%) menor que o cobrado (%)', p_valor_centavos, c.valor_centavos;
  end if;

  comissao := case when c.codigo_ref is null then 0
                   else round(p_valor_centavos * p_comissao_pct / 100) end;

  update public.rotina_checkouts
     set status = 'pago', pago_em = now(), pagbank_charge_id = p_charge_id,
         valor_pago_centavos = p_valor_centavos, comissao_centavos = comissao
   where id = c.id;

  insert into public.rotina_assinaturas as a (email, ativa_ate)
  values (lower(c.email), now() + interval '30 days')
  on conflict (email) do update
    set ativa_ate = greatest(a.ativa_ate, now()) + interval '30 days',
        atualizado_em = now();

  if c.codigo_ref is not null then
    -- Se a tabela de afiliadas tiver alguma coluna obrigatória diferente,
    -- a venda continua confirmada e a comissão fica registrada no checkout.
    begin
      insert into public.affiliate_sales
        (codigo_ref, email_cliente, app_origem, nome_app, valor_venda, valor_comissao, status_pagamento, charge_id)
      values
        (c.codigo_ref, lower(c.email), 'Rotina Azul', 'Rotina Azul',
         p_valor_centavos / 100.0, comissao / 100.0, 'pago', p_charge_id)
      on conflict (charge_id) do nothing;
    exception when others then
      raise warning 'affiliate_sales não registrada para checkout %: %', c.id, sqlerrm;
    end;
  end if;

  return true;
end;
$$;

revoke all on function public.rotina_confirmar_pagamento(uuid, text, integer, numeric) from public, anon, authenticated;
grant execute on function public.rotina_confirmar_pagamento(uuid, text, integer, numeric) to service_role;
