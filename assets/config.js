/* ============================================================
   MINERVA — public front-end Supabase config.
   These two values are PUBLIC by design (the anon key is safe to
   ship; Row Level Security protects the data). The owner fills the
   placeholders with the real project values before go-live.

   This file MUST load before assets/vip.js (the access engine reads
   window.MINERVA_SUPABASE). On pages that load the engine through
   assets/minerva.js, that loader injects this file first; admin.html
   loads it directly, in the correct order, in its <head>/scripts.
   ============================================================ */
window.MINERVA_SUPABASE = {
  url: "https://ojwvdfdkybutuflwbutd.supabase.co",
  anonKey: "REPLACE_WITH_SUPABASE_ANON_KEY"   // public anon key — fill before go-live
};
