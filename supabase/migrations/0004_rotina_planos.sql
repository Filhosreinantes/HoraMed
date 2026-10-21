-- Planos do Rotina Azul: mensal (30 dias), anual (365 dias) e vitalício (100 anos).
--
-- Como aplicar: Supabase > SQL Editor > cole este arquivo inteiro > Run.
-- É seguro rodar mais de uma vez. Depois, publique as funções:
--   supabase functions deploy rotina-azul-checkout rotina-azul-webhook
-- Os preços e prazos ficam em src/lib/planos.ts (o servidor cobra por lá).

alter table public.rotina_checkouts
  add column if not exists plano text not null default 'mensal'
    check (plano in ('mensal', 'anual', 'vitalicio'));

-- A confirmação passa a somar o prazo do plano comprado, e não sempre 30 dias.
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
  dias     integer;
begin
  -- Trava a linha: webhook e consulta simultâneos não confirmam duas vezes.
  select * into c from public.rotina_checkouts where id = p_checkout for update;
  if not found or c.status = 'pago' then
    return false;
  end if;
  if p_valor_centavos < c.valor_centavos then
    raise exception 'valor pago (%) menor que o cobrado (%)', p_valor_centavos, c.valor_centavos;
  end if;

  -- Prazo do plano comprado (mesmos valores de src/lib/planos.ts).
  dias := case c.plano when 'anual' then 365 when 'vitalicio' then 36500 else 30 end;

  comissao := case when c.codigo_ref is null then 0
                   else round(p_valor_centavos * p_comissao_pct / 100) end;

  update public.rotina_checkouts
     set status = 'pago', pago_em = now(), pagbank_charge_id = p_charge_id,
         valor_pago_centavos = p_valor_centavos, comissao_centavos = comissao
   where id = c.id;

  insert into public.rotina_assinaturas as a (email, ativa_ate)
  values (lower(c.email), now() + make_interval(days => dias))
  on conflict (email) do update
    set ativa_ate = greatest(a.ativa_ate, now()) + make_interval(days => dias),
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
