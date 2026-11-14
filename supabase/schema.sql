-- =====================================================================
-- Supabase projekt "mtb-servis" (ref klpcgnivfvczvvyoqzal)
-- Snímek schématu stažený 2026-11-14 (jen čtení, nic nebylo změněno).
-- Slouží jako záloha a zdroj pravdy; změny dělat novou migrací
-- v supabase/migrations/ a tento soubor pak obnovit.
-- Neobsahuje data ani klíče.
-- =====================================================================

-- Kódy komponent: retez, prevodnik, kazeta, desP, desZ (destičky přední/zadní),
-- kotP, kotZ (kotouče), plaP, plaZ (pláště), vidlice, tlumic, ostatni

create table public.mtb_kolo (
  user_id uuid not null default auth.uid(),
  nazev text not null default 'MTB'::text,
  barva text,
  velikost text,
  koupe date not null,
  limity jsonb not null default '{"desP": 3000, "desZ": 2000, "retez": 1500}'::jsonb,
  upraveno timestamp with time zone not null default now()
);
alter table public.mtb_kolo add constraint mtb_kolo_pkey PRIMARY KEY (user_id);
alter table public.mtb_kolo add constraint mtb_kolo_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

create table public.mtb_doklady (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  datum date not null,
  typ text not null,
  servis text,
  cislo text,
  prace numeric(10,2) not null default 0,
  popis text,
  ukony text[] not null default '{}'::text[],
  poznamka text,
  soubor text,
  vlozeno timestamp with time zone not null default now()
);
alter table public.mtb_doklady add constraint mtb_doklady_pkey PRIMARY KEY (id);
alter table public.mtb_doklady add constraint mtb_doklady_typ_check CHECK ((typ = ANY (ARRAY['vymena'::text, 'kontrola'::text, 'nakup'::text])));
alter table public.mtb_doklady add constraint mtb_doklady_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

create table public.mtb_jizdy (
  id bigint generated always as identity not null,
  user_id uuid not null default auth.uid(),
  zacatek timestamp with time zone not null,
  km numeric(8,3) not null,
  zdroj text not null default 'connect'::text,
  vlozeno timestamp with time zone not null default now()
);
alter table public.mtb_jizdy add constraint mtb_jizdy_pkey PRIMARY KEY (id);
alter table public.mtb_jizdy add constraint mtb_jizdy_km_check CHECK (((km > (0)::numeric) AND (km < (1000)::numeric)));
alter table public.mtb_jizdy add constraint mtb_jizdy_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.mtb_jizdy add constraint mtb_jizdy_user_id_zacatek_key UNIQUE (user_id, zacatek);
alter table public.mtb_jizdy add constraint mtb_jizdy_zdroj_check CHECK ((zdroj = ANY (ARRAY['connect'::text, 'rucne'::text, 'sportstracker'::text])));
CREATE INDEX mtb_jizdy_user_zacatek ON public.mtb_jizdy USING btree (user_id, zacatek DESC);

create table public.mtb_kusy (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  komponenta text not null,
  model text,
  od date not null,
  "do" date,
  cena numeric(10,2),
  doklad_id uuid,
  limit_km numeric(8,0),
  limit_doklad_id uuid
);
alter table public.mtb_kusy add constraint mtb_kusy_pkey PRIMARY KEY (id);
alter table public.mtb_kusy add constraint mtb_kusy_check CHECK ((("do" IS NULL) OR ("do" >= od)));
alter table public.mtb_kusy add constraint mtb_kusy_doklad_id_fkey FOREIGN KEY (doklad_id) REFERENCES mtb_doklady(id) ON DELETE SET NULL;
alter table public.mtb_kusy add constraint mtb_kusy_komponenta_check CHECK ((komponenta = ANY (ARRAY['retez'::text, 'prevodnik'::text, 'kazeta'::text, 'desP'::text, 'desZ'::text, 'kotP'::text, 'kotZ'::text, 'plaP'::text, 'plaZ'::text, 'vidlice'::text, 'tlumic'::text, 'ostatni'::text])));
alter table public.mtb_kusy add constraint mtb_kusy_limit_doklad_id_fkey FOREIGN KEY (limit_doklad_id) REFERENCES mtb_doklady(id) ON DELETE SET NULL;
alter table public.mtb_kusy add constraint mtb_kusy_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX mtb_kusy_user ON public.mtb_kusy USING btree (user_id, komponenta, od);

create table public.mtb_polozky (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  doklad_id uuid not null,
  poradi integer not null default 0,
  popis text not null,
  cena numeric(10,2),
  komponenta text,
  kategorie text not null default 'dily'::text
);
alter table public.mtb_polozky add constraint mtb_polozky_pkey PRIMARY KEY (id);
alter table public.mtb_polozky add constraint mtb_polozky_doklad_id_fkey FOREIGN KEY (doklad_id) REFERENCES mtb_doklady(id) ON DELETE CASCADE;
alter table public.mtb_polozky add constraint mtb_polozky_kategorie_check CHECK ((kategorie = ANY (ARRAY['dily'::text, 'doplnky'::text])));
alter table public.mtb_polozky add constraint mtb_polozky_komponenta_check CHECK ((komponenta = ANY (ARRAY['retez'::text, 'prevodnik'::text, 'kazeta'::text, 'desP'::text, 'desZ'::text, 'kotP'::text, 'kotZ'::text, 'plaP'::text, 'plaZ'::text, 'vidlice'::text, 'tlumic'::text, 'ostatni'::text])));
alter table public.mtb_polozky add constraint mtb_polozky_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

create table public.mtb_verdikty (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  doklad_id uuid not null,
  kus_id uuid not null,
  plus_km numeric(8,0) not null default 0,
  text text
);
alter table public.mtb_verdikty add constraint mtb_verdikty_pkey PRIMARY KEY (id);
alter table public.mtb_verdikty add constraint mtb_verdikty_doklad_id_fkey FOREIGN KEY (doklad_id) REFERENCES mtb_doklady(id) ON DELETE CASCADE;
alter table public.mtb_verdikty add constraint mtb_verdikty_kus_id_fkey FOREIGN KEY (kus_id) REFERENCES mtb_kusy(id) ON DELETE CASCADE;
alter table public.mtb_verdikty add constraint mtb_verdikty_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ---------- Pohled: km a platný limit každého kusu ----------
-- km = součet jízd od data montáže (od) do data výměny (do), podle data v Praze
-- limit_platny = vlastní limit kusu, jinak výchozí limit z mtb_kolo.limity
create or replace view public.mtb_stav_kusu with (security_invoker=true) as
 SELECT id,
    user_id,
    komponenta,
    model,
    od,
    "do",
    cena,
    doklad_id,
    limit_km,
    limit_doklad_id,
    COALESCE(( SELECT sum(j.km) AS sum
           FROM mtb_jizdy j
          WHERE j.user_id = k.user_id AND (j.zacatek AT TIME ZONE 'Europe/Prague'::text)::date >= k.od AND (k."do" IS NULL OR (j.zacatek AT TIME ZONE 'Europe/Prague'::text)::date < k."do")), 0::numeric)::numeric(10,3) AS km,
    COALESCE(limit_km, ( SELECT (b.limity ->> k.komponenta)::numeric AS "numeric"
           FROM mtb_kolo b
          WHERE b.user_id = k.user_id)) AS limit_platny
   FROM mtb_kusy k;

-- ---------- RLS: každý vidí jen své ----------
alter table public.mtb_kolo enable row level security;
alter table public.mtb_doklady enable row level security;
alter table public.mtb_jizdy enable row level security;
alter table public.mtb_kusy enable row level security;
alter table public.mtb_polozky enable row level security;
alter table public.mtb_verdikty enable row level security;

create policy vlastni on public.mtb_kolo as PERMISSIVE for ALL to authenticated
  using ((user_id = auth.uid()))
  with check ((user_id = auth.uid()));
create policy vlastni on public.mtb_doklady as PERMISSIVE for ALL to authenticated
  using ((user_id = auth.uid()))
  with check ((user_id = auth.uid()));
create policy vlastni on public.mtb_jizdy as PERMISSIVE for ALL to authenticated
  using ((user_id = auth.uid()))
  with check ((user_id = auth.uid()));
create policy vlastni on public.mtb_kusy as PERMISSIVE for ALL to authenticated
  using ((user_id = auth.uid()))
  with check ((user_id = auth.uid()));
create policy vlastni on public.mtb_polozky as PERMISSIVE for ALL to authenticated
  using ((user_id = auth.uid()))
  with check ((user_id = auth.uid()));
create policy vlastni on public.mtb_verdikty as PERMISSIVE for ALL to authenticated
  using ((user_id = auth.uid()))
  with check ((user_id = auth.uid()));

-- ---------- Storage: skeny dokladů ve složce <user_id>/… ----------
insert into storage.buckets (id, name, public) values ('mtb-doklady', 'mtb-doklady', false);

create policy "mtb doklady vlastni" on storage.objects as PERMISSIVE for ALL to authenticated
  using (((bucket_id = 'mtb-doklady'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)))
  with check (((bucket_id = 'mtb-doklady'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
