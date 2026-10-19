-- Lembretes de medicação do Rotina Azul (OneSignal), enviados a cada minuto.
--
-- Como aplicar: Supabase > SQL Editor > cole este arquivo inteiro > Run.
-- É seguro rodar mais de uma vez.

-- ─── Um registro por lembrete enviado: impede envio duplicado ───
create table if not exists public.rotina_lembretes_enviados (
  item_id    text not null,          -- id da medicação (pedacinho_registros.dados->>id)
  data       date not null,          -- dia em Brasília
  horario    text not null,          -- "HH:MM"
  user_id    uuid not null,
  enviado_em timestamptz not null default now(),
  primary key (item_id, data, horario)
);

-- Só as Edge Functions (service role) acessam.
alter table public.rotina_lembretes_enviados enable row level security;

-- ─── Agendamento: chama a função a cada minuto ───
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule(jobid) from cron.job
 where jobname in ('rotina-azul-lembretes', 'rotina-azul-lembretes-limpeza');

select cron.schedule(
  'rotina-azul-lembretes',
  '* * * * *',
  $$
  select net.http_post(
    url     := 'https://jzigayoqkgnqjtdfjskf.supabase.co/functions/v1/rotina-azul-lembretes',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);

-- Apaga o controle de envios com mais de 30 dias (todo dia às 3h UTC).
select cron.schedule(
  'rotina-azul-lembretes-limpeza',
  '0 3 * * *',
  $$ delete from public.rotina_lembretes_enviados where data < current_date - 30; $$
);
