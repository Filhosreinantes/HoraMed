-- Fuso horário de cada usuária, para os lembretes chegarem na hora local.
--
-- Como aplicar: Supabase > SQL Editor > cole este arquivo inteiro > Run.
-- É seguro rodar mais de uma vez.

create table if not exists public.rotina_preferencias (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  fuso          text not null default 'America/Sao_Paulo',  -- ex.: America/Manaus
  atualizado_em timestamptz not null default now()
);

alter table public.rotina_preferencias enable row level security;

-- Cada usuária lê e grava só a própria linha (o app salva o fuso do aparelho).
drop policy if exists "rotina_preferencias_propria" on public.rotina_preferencias;
create policy "rotina_preferencias_propria" on public.rotina_preferencias
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
