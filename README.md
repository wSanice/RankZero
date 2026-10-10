# Abibas / Sistema

App React (Vite) com o design "System Status Interface", 100% alimentado pelo Supabase.

## Rodar

1. Rode `supabase/deploy.sql` inteiro no SQL Editor do Supabase (idempotente —
   rode de novo a cada deploy, sem medo: ele nunca apaga tabela nem dado, só
   cria o que falta e atualiza funções/políticas). `schema.sql`,
   `002_progressao.sql` e `003_boss_fixes_and_guild_invites.sql` ficam só
   como histórico — não precisam mais ser rodados.
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
