# Abibas / Sistema

App React (Vite) com o design "System Status Interface", 100% alimentado pelo Supabase.

## Rodar

1. Rode o SQL do schema no Supabase (SQL Editor) e depois `supabase/002_progressao.sql`.
2. `cp .env.example .env` e preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
3. `npm install && npm run dev`

Em Authentication > Providers, habilite Email (e Google/Apple se quiser os botões sociais).

## Telas e tabelas

| Tela | Tabelas |
|---|---|
| Login / cadastro | `auth.users` (o trigger cria o `profiles`) |
| Início | `profiles`, `daily_missions`, `boss_raids` |
| Treinar | `workouts`, `machines`, `exercises`, `weight_logs` (o trigger aplica XP e dano) |
| Ficha | `workouts`, `machines`, `exercises` + `catalogo.js` |
| Missões | `daily_missions` |
| Raid | `boss_raids`, `combat_log` |
| Perfil | `profiles`, `weight_logs`, bucket `avatars` |
