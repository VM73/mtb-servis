// MTB servis – Edge Function „mtb“
// Supabase → Edge Functions → Deploy a new function → Via Editor → název: mtb → vložit celé → Deploy
// Verify JWT: VYPNUTO (zkratka posílá vlastní token v hlavičce x-zkratka-token)
// Secrets: SHORTCUT_TOKEN, OWNER_USER_ID, OPENAI_API_KEY (pro čtení faktur), volitelně OPENAI_MODEL
//          (SUPABASE_URL a SUPABASE_SERVICE_ROLE_KEY dodá Supabase sám)
//
// Akce:
//   POST ?akce=jizdy  tělo {"radky":"2026-10-16T15:40:00+02:00;57,071\n..."}  → uloží nové jízdy, vrátí stav a text oznámení
//   GET  ?akce=stav                                                             → jen stav komponent (pro test)
//   POST ?akce=faktura  hlavička Authorization: Bearer <JWT přihlášeného uživatele>, tělo {"cesta":"<user_id>/<soubor>"}
//        → přečte sken faktury z úložiště mtb-doklady přes OpenAI a vrátí návrh dokladu (nic neukládá)
import { createClient } from "jsr:@supabase/supabase-js@2";
import { encodeBase64 } from "jsr:@std/encoding@1/base64";

const VERZE = "mtb-funkce v3";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-zkratka-token",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const NAZVY: Record<string, string> = {
  retez: "Řetěz", prevodnik: "Převodník", kazeta: "Kazeta", desP: "Destičky přední", desZ: "Destičky zadní",
  kotP: "Kotouč přední", kotZ: "Kotouč zadní", plaP: "Plášť přední", plaZ: "Plášť zadní",
  vidlice: "Vidlice", tlumic: "Tlumič", ostatni: "Ostatní",
};

// <logika>
// Řádek ze zkratky: "<datum začátku ISO 8601>;<km>". Km může mít desetinnou čárku, mezery i „km“.
function parsujRadky(text: string) {
  const ok: { zacatek: string; km: number }[] = [];
  const chyby: string[] = [];
  for (const raw of String(text ?? "").split(/\r?\n/)) {
    const r = raw.trim();
    if (!r) continue;
    const i = r.lastIndexOf(";");
    if (i < 0) { chyby.push(r); continue; }
    const d = new Date(r.slice(0, i).trim());
    const km = parseFloat(r.slice(i + 1).replace(/km/i, "").replace(/\s/g, "").replace(",", "."));
    if (isNaN(d.getTime()) || !(km > 0 && km < 1000)) { chyby.push(r); continue; }
    ok.push({ zacatek: d.toISOString(), km: Math.round(km * 1000) / 1000 });
  }
  return { ok, chyby };
}
// Oznámení jen pro kusy na kole s limitem, které jsou na 80 % a víc.
function oznameni(kusy: { komponenta: string; km: number; limit_platny: number | null; do?: string | null }[]) {
  const radky: string[] = [];
  for (const k of kusy) {
    if (k.do || !k.limit_platny) continue;
    const km = Number(k.km), lim = Number(k.limit_platny), zb = Math.round(lim - km);
    if (km / lim < 0.8) continue;
    const n = NAZVY[k.komponenta] ?? k.komponenta;
    radky.push(zb >= 0 ? `${n}: zbývá ${zb} km` : `${n}: limit překročen o ${-zb} km`);
  }
  return radky.join("\n");
}
// </logika>

const KOMPONENTY = ["retez", "prevodnik", "kazeta", "desP", "desZ", "kotP", "kotZ", "plaP", "plaZ", "vidlice", "tlumic", "ostatni"];
const SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["datum", "dodavatel", "cislo", "typ", "prace", "popis", "ukony", "polozky"],
  properties: {
    datum: { type: "string", description: "Datum zdanitelného plnění (kdy byl servis hotový) ve formátu YYYY-MM-DD" },
    dodavatel: { type: "string" },
    cislo: { type: "string", description: "Číslo faktury nebo objednávky, např. FA 20262768" },
    typ: { type: "string", enum: ["vymena", "kontrola", "nakup"] },
    prace: { type: "number", description: "Součet cen řádků za servisní práci (vč. DPH), 0 když není" },
    popis: { type: "string", description: "Stručný popis servisu z dokladu, prázdný text když není" },
    ukony: { type: "array", items: { type: "string" }, description: "Provedené servisní úkony, krátce" },
    polozky: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        required: ["popis", "cena", "komponenta", "kategorie"],
        properties: {
          popis: { type: "string" },
          cena: { type: ["number", "null"], description: "Celková cena řádku vč. DPH v Kč; sleva záporně; null když díl dodal zákazník" },
          komponenta: { type: ["string", "null"], enum: [...KOMPONENTY, null] },
          kategorie: { type: "string", enum: ["dily", "doplnky"] },
        },
      },
    },
  },
};
const PROMPT = `Jsi asistent pro evidenci servisu horského kola (Specialized Epic, SRAM GX Eagle 12s). Přečti přiložený doklad z cykloservisu a vrať JSON podle schématu.
Pravidla:
- datum = datum zdanitelného plnění (ne datum vystavení objednávky), formát YYYY-MM-DD.
- Ceny ber ze sloupce celková cena vč. DPH, v Kč, jako číslo s desetinnou tečkou. Řádky s 0 Kč, které jen popisují zakázku (např. „Celková kontrola – udělat vše“), nedávej do položek, ale do popisu a úkonů.
- Řádky „SERVIS …“ nebo práce s cenou sečti do pole prace a jejich text dej do popisu a úkonů.
- Položky: díly a zboží. komponenta = retez (řetěz), prevodnik (převodník), kazeta, desP/desZ (brzdové destičky přední/zadní), kotP/kotZ (kotouč přední/zadní), plaP/plaZ (plášť přední/zadní; když není jasné, nech null), vidlice, tlumic, ostatni (jiný díl na kole, např. hlavové složení, objímka), jinak null.
- kategorie = doplnky pro věci, které nejsou díl kola nebo jsou spotřební: helma, lahve, oblečení, čističe, oleje, maziva, kartáče, duše, gripy. Jinak dily. Sleva a zaokrouhlení: komponenta null, kategorie dily, záporná cena.
- typ = vymena, když je aspoň jedna položka s komponentou; kontrola, když je jen servisní práce bez dílů; nakup, když jsou jen doplňky.`;

async function faktura(req: Request) {
  const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: u, error: eu } = await sb.auth.getUser(jwt);
  if (eu || !u?.user) return json({ chyba: "Nepřihlášený uživatel", verze: VERZE }, 401);
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) return json({ chyba: "Chybí secret OPENAI_API_KEY – vyplň položky ručně", verze: VERZE }, 501);
  const body = await req.json().catch(() => ({}));
  const cesta = String(body.cesta ?? "");
  if (!cesta.startsWith(u.user.id + "/")) return json({ chyba: "Soubor nepatří přihlášenému uživateli", verze: VERZE }, 403);
  const { data: blob, error: ed } = await sb.storage.from("mtb-doklady").download(cesta);
  if (ed || !blob) return json({ chyba: "Soubor se nepodařilo načíst: " + (ed?.message ?? ""), verze: VERZE }, 404);
  const b64 = encodeBase64(new Uint8Array(await blob.arrayBuffer()));
  const pdf = /\.pdf$/i.test(cesta) || blob.type === "application/pdf";
  const priloha = pdf
    ? { type: "file", file: { filename: "doklad.pdf", file_data: `data:application/pdf;base64,${b64}` } }
    : { type: "image_url", image_url: { url: `data:${blob.type || "image/jpeg"};base64,${b64}` } };
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: Deno.env.get("OPENAI_MODEL") || "gpt-4.1-mini",
      temperature: 0,
      messages: [{ role: "system", content: PROMPT }, { role: "user", content: [{ type: "text", text: "Doklad:" }, priloha] }],
      response_format: { type: "json_schema", json_schema: { name: "doklad", strict: true, schema: SCHEMA } },
    }),
  });
  const out = await r.json();
  if (!r.ok) return json({ chyba: "OpenAI: " + (out?.error?.message ?? r.status), verze: VERZE }, 502);
  const navrh = JSON.parse(out.choices?.[0]?.message?.content ?? "{}");
  return json({ verze: VERZE, navrh });
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const akce = new URL(req.url).searchParams.get("akce") ?? "";
  try {
    if (akce === "faktura") return await faktura(req);
    if (req.headers.get("x-zkratka-token") !== Deno.env.get("SHORTCUT_TOKEN")) return json({ chyba: "Neplatný token zkratky", verze: VERZE }, 401);
    const uid = Deno.env.get("OWNER_USER_ID");
    if (!uid) return json({ chyba: "Chybí secret OWNER_USER_ID", verze: VERZE }, 500);
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

    let nove = 0, prijato = 0, chybne: string[] = [];
    if (akce === "jizdy") {
      if (req.method !== "POST") return json({ chyba: "Použij POST", verze: VERZE }, 405);
      const body = await req.json().catch(() => ({}));
      const { ok, chyby } = parsujRadky(body.radky);
      prijato = ok.length; chybne = chyby;
      if (!ok.length && !chyby.length) return json({ chyba: "Prázdná data, žádná jízda nepřišla", verze: VERZE }, 400);
      if (ok.length) {
        const { data, error } = await sb.from("mtb_jizdy")
          .upsert(ok.map((j) => ({ ...j, user_id: uid, zdroj: "connect" })), { onConflict: "user_id,zacatek", ignoreDuplicates: true })
          .select("id");
        if (error) throw error;
        nove = data?.length ?? 0;
      }
    } else if (akce !== "stav") {
      return json({ chyba: "Neznámá akce (jizdy | stav | faktura)", verze: VERZE }, 400);
    }

    const { data: kusy, error: e2 } = await sb.from("mtb_stav_kusu")
      .select("komponenta, model, od, do, km, limit_platny").eq("user_id", uid).is("do", null);
    if (e2) throw e2;
    const retez = kusy?.find((k) => k.komponenta === "retez");
    const { count } = await sb.from("mtb_jizdy").select("id", { count: "exact", head: true }).eq("user_id", uid);
    return json({
      verze: VERZE, prijato, nove, chybne, jizd_celkem: count,
      retez: retez ? { km: Number(retez.km), limit: retez.limit_platny, zbyva: retez.limit_platny ? Math.round(retez.limit_platny - retez.km) : null } : null,
      // prázdné oznámení se vůbec neposílá – zkratka pak podmínku „obsahuje libovolnou hodnotu“ vyhodnotí jako nepravdu
      oznameni: oznameni(kusy ?? []) || undefined,
    });
  } catch (e) {
    console.error(e);
    return json({ chyba: String((e as Error)?.message ?? e), verze: VERZE }, 500);
  }
});
