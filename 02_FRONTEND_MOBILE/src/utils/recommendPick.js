// ============================================================================
// recommendPick.js — motor de recomendación de pick para Champion Select
// ----------------------------------------------------------------------------
// Dado el estado del champion select (picks enemigos + pool del usuario)
// recomienda el mejor campeón a elegir. La recomendación combina TRES señales:
//
// 1. Matchup 1-vs-1: la MATCHUP_TABLE de abajo dice contra qué campeones va
// bien o mal cada pick. Por cada enemigo "good" suma y por cada "bad" resta.
// 2. Composición enemiga: analyzeEnemyComposition detecta arquetipos del
// equipo rival (AD/AP heavy, hard engage, hyper-carry, poke, burst,
// splitpush, sustain) y compositionBonus premia a los picks que los
// counterean — visión global de equipo, no solo de la línea.
// 3. Rol elegido y winrate del usuario: si hay rol seleccionado se filtra el
// pool a ese rol; el WR del usuario aporta un pequeño ajuste (±1).
//
// Devuelve { champion, reason, confidence, detail } — `detail` es la versión
// estructurada (good/bad matchups, comp counters, tags enemigos) que el UI
// pinta en chips. Función 100% pura: sin UI ni almacenamiento.
// ============================================================================
import { CHAMPIONS } from '../data/championsCatalog';

// Tabla curada de matchups. Cada entrada lista contra quién va FAVORABLE
// (goodAgainst) y DESFAVORABLE (badAgainst) ese campeón. Se mantiene a mano con
// conocimiento de LoL; en producción vendría de un dataset externo (Lolalytics,
// datos pro). Los nombres son PascalCase para coincidir con championsCatalog.js
// y con el pool del usuario.
export const MATCHUP_TABLE = {
  // ─── ADCs ──────────────────────────────────────────────────────────────
  Jinx:        { goodAgainst: ['Ashe', 'MissFortune', 'Jhin', 'Sivir', 'KogMaw'],            badAgainst: ['Caitlyn', 'Draven', 'Lucian', 'Samira'] },
  Caitlyn:     { goodAgainst: ['Jinx', 'Ashe', 'Sivir', 'Tristana', 'KogMaw'],               badAgainst: ['Draven', 'KaiSa', 'Samira', 'Nilah'] },
  Lucian:      { goodAgainst: ['Jinx', 'Ashe', 'Caitlyn', 'Sivir', 'KogMaw', 'Kassadin'],    badAgainst: ['Vayne', 'KaiSa', 'Tristana', 'Samira'] },
  KaiSa:       { goodAgainst: ['Ashe', 'Jhin', 'Sivir', 'Jinx', 'KogMaw'],                   badAgainst: ['Caitlyn', 'MissFortune', 'Draven', 'Lucian'] },
  Ezreal:      { goodAgainst: ['MissFortune', 'Sivir', 'Caitlyn', 'KogMaw', 'Tristana'],     badAgainst: ['Draven', 'Lucian', 'KaiSa', 'Samira'] },
  Jhin:        { goodAgainst: ['Jinx', 'Ashe', 'Xayah', 'KogMaw'],                           badAgainst: ['Draven', 'KaiSa', 'Lucian', 'Samira'] },
  Vayne:       { goodAgainst: ['Lucian', 'Caitlyn', 'Jinx', 'KogMaw', 'Ashe', 'Sivir'],      badAgainst: ['Draven', 'KaiSa', 'Samira', 'Tristana'] },
  Draven:      { goodAgainst: ['Caitlyn', 'Jhin', 'Jinx', 'Ashe', 'Sivir', 'MissFortune'],   badAgainst: ['Vayne', 'Samira', 'KaiSa', 'Tristana'] },
  KogMaw:      { goodAgainst: ['Vayne', 'Twitch', 'Sivir'],                                  badAgainst: ['Caitlyn', 'Draven', 'Lucian', 'Samira'] },
  Tristana:    { goodAgainst: ['Caitlyn', 'Jhin', 'Sivir', 'Ashe', 'Jinx'],                  badAgainst: ['Draven', 'Samira', 'KaiSa', 'Vayne'] },
  Sivir:       { goodAgainst: ['Lux', 'Morgana', 'Karma', 'Xerath', 'Brand'],                badAgainst: ['Caitlyn', 'Draven', 'Lucian', 'Vayne'] },
  Twitch:      { goodAgainst: ['Caitlyn', 'Jhin', 'Sivir', 'Ashe', 'Xayah'],                 badAgainst: ['Vayne', 'Draven', 'Samira', 'Tristana'] },
  Samira:      { goodAgainst: ['Caitlyn', 'Sivir', 'Jhin', 'Ashe', 'MissFortune', 'Jinx'],   badAgainst: ['Vayne', 'Draven', 'KogMaw', 'Tristana'] },
  Xayah:       { goodAgainst: ['Caitlyn', 'Jinx', 'Jhin', 'Sivir', 'KogMaw'],                badAgainst: ['Draven', 'Samira', 'KaiSa', 'Vayne'] },
  Kalista:     { goodAgainst: ['Vayne', 'Caitlyn', 'Jhin', 'Sivir'],                         badAgainst: ['Draven', 'Samira', 'KaiSa', 'Tristana'] },
  Aphelios:    { goodAgainst: ['Jinx', 'Caitlyn', 'Sivir', 'Ashe', 'KogMaw'],                badAgainst: ['Draven', 'Samira', 'KaiSa', 'Lucian'] },
  Nilah:       { goodAgainst: ['Caitlyn', 'Jhin', 'Sivir', 'Soraka', 'Yuumi', 'Sona'],       badAgainst: ['Draven', 'Samira', 'Vayne', 'Tristana'] },
  Ashe:        { goodAgainst: ['MissFortune', 'Sivir', 'Jhin'],                              badAgainst: ['Caitlyn', 'Draven', 'Lucian', 'Samira'] },
  MissFortune: { goodAgainst: ['Caitlyn', 'Sivir', 'Ashe', 'Jhin'],                          badAgainst: ['Draven', 'Samira', 'Vayne', 'KaiSa'] },

  // ─── MIDs ──────────────────────────────────────────────────────────────
  Ahri:        { goodAgainst: ['Malzahar', 'Yasuo', 'Kassadin', 'Cassiopeia', 'Veigar'],     badAgainst: ['Katarina', 'Fizz', 'Zed', 'Talon'] },
  Zed:         { goodAgainst: ['Orianna', 'Syndra', 'Lux', 'Xerath', 'Viktor', 'Veigar'],    badAgainst: ['Malzahar', 'Galio', 'Annie', 'Pantheon', 'Lissandra'] },
  Orianna:     { goodAgainst: ['Zed', 'Katarina', 'Diana', 'Akali'],                         badAgainst: ['Fizz', 'Yasuo', 'Ahri', 'Talon', 'Leblanc'] },
  Syndra:      { goodAgainst: ['Yasuo', 'Katarina', 'Akali', 'Malzahar', 'Ahri'],            badAgainst: ['Zed', 'Talon', 'Fizz', 'Leblanc'] },
  Yasuo:       { goodAgainst: ['Orianna', 'Xayah', 'Malphite', 'Lux', 'Karma', 'Veigar'],    badAgainst: ['Annie', 'Pantheon', 'Renekton', 'Malzahar', 'Galio'] },
  Lux:         { goodAgainst: ['Morgana', 'Soraka', 'Nami', 'Sona', 'Yuumi', 'Karma'],       badAgainst: ['Zed', 'Talon', 'Katarina', 'Fizz'] },
  Malzahar:    { goodAgainst: ['Zed', 'Katarina', 'Akali', 'Yasuo', 'Yone', 'Fizz', 'Leblanc'], badAgainst: ['Syndra', 'Ahri', 'Viktor', 'Orianna'] },
  Viktor:      { goodAgainst: ['Yasuo', 'Zed', 'Talon', 'Katarina'],                         badAgainst: ['Leblanc', 'Fizz', 'Akali'] },
  TwistedFate: { goodAgainst: ['Annie', 'Veigar', 'Lux', 'Xerath', 'Orianna'],               badAgainst: ['Fizz', 'Katarina', 'Leblanc', 'Talon'] },
  Fizz:        { goodAgainst: ['Orianna', 'Syndra', 'Lux', 'Xerath', 'Veigar', 'Karma', 'Ahri'], badAgainst: ['Annie', 'Pantheon', 'Talon', 'Renekton'] },
  Akali:       { goodAgainst: ['Lux', 'Orianna', 'Syndra', 'Karma', 'Xerath', 'Viktor'],     badAgainst: ['Galio', 'Pantheon', 'Annie', 'Renekton'] },
  Leblanc:     { goodAgainst: ['Annie', 'Lux', 'Karma', 'Veigar', 'Xerath'],                 badAgainst: ['Galio', 'Malzahar', 'Kassadin'] },
  Yone:        { goodAgainst: ['Akali', 'Zed', 'Yasuo', 'Lux', 'Karma'],                     badAgainst: ['Pantheon', 'Renekton', 'Annie', 'Malzahar'] },
  Corki:       { goodAgainst: ['Zed', 'Yasuo', 'Talon', 'Annie'],                            badAgainst: ['Fizz', 'Leblanc', 'Katarina', 'Akali'] },
  Cassiopeia:  { goodAgainst: ['Yasuo', 'Yone', 'Akali', 'Irelia'],                          badAgainst: ['Leblanc', 'Fizz', 'Katarina', 'Talon'] },
  Galio:       { goodAgainst: ['Zed', 'Yasuo', 'Akali', 'Talon', 'Leblanc', 'Yone', 'Katarina'], badAgainst: ['Cassiopeia', 'Vladimir', 'Kassadin'] },
  Talon:       { goodAgainst: ['Annie', 'Lux', 'Orianna', 'Veigar', 'Xerath', 'Karma', 'Vladimir'], badAgainst: ['Renekton', 'Pantheon', 'Malzahar', 'Galio'] },
  Xerath:      { goodAgainst: ['Zed', 'Talon', 'Yasuo', 'Annie', 'Garen'],                   badAgainst: ['Fizz', 'Leblanc', 'Katarina', 'Akali'] },
  Annie:       { goodAgainst: ['Zed', 'Akali', 'Yasuo', 'Talon', 'Yone', 'Leblanc'],         badAgainst: ['Fizz', 'Cassiopeia', 'Vladimir'] },
  Veigar:      { goodAgainst: ['Akali', 'Zed', 'Katarina', 'Yasuo'],                         badAgainst: ['Fizz', 'Talon', 'Pantheon', 'Leblanc'] },
  Kassadin:    { goodAgainst: ['Zed', 'Talon', 'Akali', 'Leblanc', 'Syndra'],                badAgainst: ['Pantheon', 'Annie', 'Renekton', 'Lucian'] },
  Katarina:    { goodAgainst: ['Lux', 'Annie', 'Orianna', 'Karma', 'Sona'],                  badAgainst: ['Pantheon', 'Talon', 'Galio', 'Malzahar'] },

  // ─── TOPs ──────────────────────────────────────────────────────────────
  Garen:       { goodAgainst: ['Malphite', 'Shen', 'Nasus', 'Vladimir', 'Kennen'],           badAgainst: ['Darius', 'Fiora', 'Teemo', 'Vayne', 'Quinn'] },
  Darius:      { goodAgainst: ['Garen', 'Malphite', 'Nasus', 'Sett', 'Riven'],               badAgainst: ['Teemo', 'Quinn', 'Fiora', 'Vayne', 'Cho\'Gath'] },
  Fiora:       { goodAgainst: ['Darius', 'Garen', 'Malphite', 'Aatrox', 'Sett', 'Nasus'],    badAgainst: ['Pantheon', 'Renekton', 'Jax', 'Gwen'] },
  Malphite:    { goodAgainst: ['Yasuo', 'Xayah', 'Jinx', 'Riven', 'Camille', 'Tryndamere'],  badAgainst: ['Darius', 'Fiora', 'Teemo', 'Vayne'] },
  Shen:        { goodAgainst: ['Camille', 'Akali', 'Riven', 'Yasuo', 'Irelia'],              badAgainst: ['Vayne', 'Teemo', 'Quinn', 'Jayce'] },
  Kennen:      { goodAgainst: ['Aatrox', 'Renekton', 'Sett', 'Garen', 'Darius'],             badAgainst: ['Irelia', 'Riven', 'Camille', 'Jax'] },
  Illaoi:      { goodAgainst: ['Tryndamere', 'Sett', 'Mordekaiser', 'Garen', 'Darius'],      badAgainst: ['Vayne', 'Teemo', 'Jayce', 'Kennen', 'Quinn'] },
  Teemo:       { goodAgainst: ['Darius', 'Garen', 'Nasus', 'Sett', 'Mordekaiser', 'Tryndamere'], badAgainst: ['Malphite', 'Jax', 'Wukong', 'Pantheon'] },
  Irelia:      { goodAgainst: ['Yasuo', 'Akali', 'Aatrox', 'Sett', 'Riven'],                 badAgainst: ['Pantheon', 'Renekton', 'Jax', 'Quinn', 'Cassiopeia'] },
  Aatrox:      { goodAgainst: ['Riven', 'Camille', 'Renekton', 'Garen', 'Sett'],             badAgainst: ['Fiora', 'Vayne', 'Quinn', 'Jax', 'Gwen'] },
  Urgot:       { goodAgainst: ['Sett', 'Aatrox', 'Mordekaiser', 'Renekton', 'Darius'],       badAgainst: ['Vayne', 'Quinn', 'Fiora', 'Camille'] },
  Nasus:       { goodAgainst: ['Sett', 'Mordekaiser', 'Tryndamere', 'Riven', 'Vladimir'],    badAgainst: ['Darius', 'Teemo', 'Jax', 'Quinn', 'Fiora'] },
  Vladimir:    { goodAgainst: ['Nasus', 'Garen', 'Aatrox', 'Mordekaiser', 'Galio'],          badAgainst: ['Pantheon', 'Renekton', 'Talon', 'Riven'] },
  'Cho\'Gath': { goodAgainst: ['Darius', 'Renekton', 'Riven', 'Akali', 'Yasuo'],             badAgainst: ['Vayne', 'Fiora', 'Quinn', 'Teemo'] },
  Ornn:        { goodAgainst: ['Sett', 'Mordekaiser', 'Aatrox', 'Renekton'],                 badAgainst: ['Vayne', 'Fiora', 'Camille', 'Quinn'] },
  Gwen:        { goodAgainst: ['Aatrox', 'Sett', 'Garen', 'Mordekaiser', 'Nasus', 'Fiora'],  badAgainst: ['Renekton', 'Pantheon', 'Camille', 'Jax'] },
  Renekton:    { goodAgainst: ['Yasuo', 'Akali', 'Riven', 'Vladimir', 'Kennen', 'Gwen', 'Irelia'], badAgainst: ['Aatrox', 'Nasus', 'Garen', 'Mordekaiser'] },
  Pantheon:    { goodAgainst: ['Yasuo', 'Akali', 'Vladimir', 'Riven', 'Yone', 'Kassadin', 'Veigar'], badAgainst: ['Renekton', 'Aatrox', 'Quinn', 'Garen'] },
  Gragas:      { goodAgainst: ['Akali', 'Riven', 'Yasuo', 'Yone', 'Vladimir'],               badAgainst: ['Camille', 'Mordekaiser', 'Sett', 'Renekton'] },
  Wukong:      { goodAgainst: ['Riven', 'Akali', 'Yasuo', 'Teemo', 'Vladimir'],              badAgainst: ['Vayne', 'Quinn', 'Pantheon', 'Renekton'] },
  Jax:         { goodAgainst: ['Yasuo', 'Akali', 'Camille', 'Teemo', 'Nasus', 'Aatrox', 'Irelia'], badAgainst: ['Vayne', 'Quinn', 'Jayce', 'Pantheon'] },
  Mordekaiser: { goodAgainst: ['Yasuo', 'Akali', 'Yone', 'Garen', 'Sett'],                   badAgainst: ['Vayne', 'Quinn', 'Vladimir', 'Gwen', 'Cho\'Gath'] },
  Sett:        { goodAgainst: ['Yasuo', 'Akali', 'Vladimir', 'Yone'],                        badAgainst: ['Vayne', 'Mordekaiser', 'Renekton', 'Fiora', 'Gwen'] },
  Camille:     { goodAgainst: ['Riven', 'Akali', 'Renekton', 'Aatrox', 'Yasuo', 'Irelia'],   badAgainst: ['Mordekaiser', 'Sett', 'Garen', 'TahmKench'] },
  Riven:       { goodAgainst: ['Vladimir', 'Nasus', 'Mordekaiser', 'Garen'],                 badAgainst: ['Renekton', 'Pantheon', 'Jax', 'Camille'] },
  Tryndamere:  { goodAgainst: ['Garen', 'Nasus', 'Vladimir', 'Mordekaiser'],                 badAgainst: ['Pantheon', 'Teemo', 'Renekton', 'Jax'] },

  // ─── JUNGLERs ──────────────────────────────────────────────────────────
  Vi:          { goodAgainst: ['Amumu', 'Warwick', 'Hecarim', 'Sejuani', 'MasterYi'],        badAgainst: ['LeeSin', 'KhaZix', 'Graves', 'Kindred'] },
  LeeSin:      { goodAgainst: ['Amumu', 'Vi', 'Warwick', 'Sejuani', 'Nunu'],                 badAgainst: ['Jax', 'MasterYi', 'Graves', 'Kindred'] },
  Graves:      { goodAgainst: ['Amumu', 'Sejuani', 'Warwick', 'Vi', 'Hecarim'],              badAgainst: ['LeeSin', 'Kindred', 'KhaZix', 'Rammus'] },
  Ekko:        { goodAgainst: ['MasterYi', 'Warwick', 'Amumu', 'Sejuani'],                   badAgainst: ['LeeSin', 'Graves', 'KhaZix', 'Kindred'] },
  Evelynn:     { goodAgainst: ['Amumu', 'Sejuani', 'Hecarim', 'MasterYi', 'Warwick'],        badAgainst: ['LeeSin', 'Graves', 'KhaZix', 'Vi'] },
  Shaco:       { goodAgainst: ['MasterYi', 'Warwick', 'Sejuani', 'Hecarim'],                 badAgainst: ['LeeSin', 'Graves', 'Vi', 'KhaZix'] },
  Nocturne:    { goodAgainst: ['LeeSin', 'Vi', 'KhaZix', 'Graves', 'Ekko'],                  badAgainst: ['Rammus', 'Sejuani', 'Hecarim', 'Amumu'] },
  Nunu:        { goodAgainst: ['Amumu', 'Warwick', 'Sejuani', 'MasterYi'],                   badAgainst: ['LeeSin', 'Graves', 'KhaZix', 'Kindred'] },
  RekSai:      { goodAgainst: ['LeeSin', 'Vi', 'KhaZix', 'Graves', 'Ekko'],                  badAgainst: ['Sejuani', 'Rammus', 'Warwick', 'Hecarim'] },
  Sylas:       { goodAgainst: ['Diana', 'Ekko', 'Akali', 'Evelynn', 'Yasuo'],                badAgainst: ['LeeSin', 'KhaZix', 'Pantheon', 'Talon'] },
  Viego:       { goodAgainst: ['MasterYi', 'Hecarim', 'Warwick', 'Amumu'],                   badAgainst: ['LeeSin', 'KhaZix', 'Graves', 'Kindred'] },
  Kindred:     { goodAgainst: ['LeeSin', 'KhaZix', 'Graves', 'Ekko', 'Evelynn'],             badAgainst: ['Vi', 'Rammus', 'Hecarim', 'MasterYi'] },
  Rammus:      { goodAgainst: ['MasterYi', 'KhaZix', 'Graves', 'Kindred', 'LeeSin', 'Nocturne', 'Tryndamere'], badAgainst: ['Karthus', 'Vladimir', 'Amumu', 'Sejuani'] },
  KhaZix:      { goodAgainst: ['Evelynn', 'Kindred', 'Graves', 'Nocturne', 'Karthus'],       badAgainst: ['Vi', 'RekSai', 'LeeSin', 'Rammus'] },
  Hecarim:     { goodAgainst: ['Vi', 'Sejuani', 'Amumu', 'Warwick', 'Nunu'],                 badAgainst: ['Rammus', 'Jax', 'MasterYi', 'KhaZix'] },
  Sejuani:     { goodAgainst: ['Amumu', 'Warwick', 'MasterYi', 'Nunu'],                      badAgainst: ['LeeSin', 'Graves', 'KhaZix', 'Kindred'] },
  Diana:       { goodAgainst: ['Yasuo', 'Zed', 'Talon', 'Akali', 'Yone'],                    badAgainst: ['Galio', 'Pantheon', 'Annie', 'Malzahar'] },
  Warwick:     { goodAgainst: ['MasterYi', 'Vladimir', 'Aatrox', 'Sett', 'Soraka'],          badAgainst: ['Pantheon', 'Vi', 'Rammus', 'KhaZix'] },
  Amumu:       { goodAgainst: ['Vi', 'Warwick', 'MasterYi', 'Hecarim', 'Sejuani'],           badAgainst: ['LeeSin', 'KhaZix', 'Graves', 'Kindred'] },
  MasterYi:    { goodAgainst: ['Karthus', 'Sona', 'Soraka', 'Yuumi', 'Veigar'],              badAgainst: ['Pantheon', 'Rammus', 'Jax', 'Malphite', 'Amumu'] },

  // ─── SUPPORTs ──────────────────────────────────────────────────────────
  Thresh:      { goodAgainst: ['Lulu', 'Soraka', 'Yuumi', 'Sona', 'Janna'],                  badAgainst: ['Blitzcrank', 'Nautilus', 'Morgana', 'Pyke'] },
  Nautilus:    { goodAgainst: ['Thresh', 'Blitzcrank', 'Morgana', 'Soraka', 'Sona'],         badAgainst: ['Lulu', 'Janna', 'Milio', 'Karma'] },
  Blitzcrank:  { goodAgainst: ['Soraka', 'Yuumi', 'Lulu', 'Sona', 'Karma', 'Nami'],          badAgainst: ['Morgana', 'Braum', 'Thresh', 'Janna'] },
  Morgana:     { goodAgainst: ['Blitzcrank', 'Thresh', 'Leona', 'Pyke', 'Nautilus', 'Alistar'], badAgainst: ['Soraka', 'Lulu', 'Sona', 'Milio'] },
  Sona:        { goodAgainst: ['Soraka', 'Janna', 'Yuumi', 'Karma'],                         badAgainst: ['Leona', 'Nautilus', 'Blitzcrank', 'Pyke', 'Thresh'] },
  Braum:       { goodAgainst: ['Caitlyn', 'Draven', 'Jhin', 'Ashe', 'MissFortune'],          badAgainst: ['Lulu', 'Soraka', 'Janna', 'Morgana'] },
  Karma:       { goodAgainst: ['Soraka', 'Sona', 'Yuumi', 'Janna'],                          badAgainst: ['Leona', 'Nautilus', 'Blitzcrank', 'Pyke'] },
  Zilean:      { goodAgainst: ['Pyke', 'Thresh', 'Pantheon', 'MasterYi'],                    badAgainst: ['Blitzcrank', 'Leona', 'Nautilus', 'Morgana'] },
  Milio:       { goodAgainst: ['Leona', 'Nautilus', 'Blitzcrank', 'Pyke', 'Morgana', 'Alistar'], badAgainst: ['Soraka', 'Lux', 'Karma', 'Brand'] },
  Renata:      { goodAgainst: ['Leona', 'Nautilus', 'Sett', 'Alistar', 'Pyke'],              badAgainst: ['Lulu', 'Soraka', 'Janna', 'Milio'] },
  RenataGlasc: { goodAgainst: ['Leona', 'Nautilus', 'Sett', 'Alistar', 'Pyke'],              badAgainst: ['Lulu', 'Soraka', 'Janna', 'Milio'] },
  Alistar:     { goodAgainst: ['Soraka', 'Lulu', 'Sona', 'Yuumi', 'Karma'],                  badAgainst: ['Morgana', 'Janna', 'Lux', 'Milio'] },
  TahmKench:   { goodAgainst: ['Sona', 'Soraka', 'Yuumi', 'Karma', 'Janna', 'Camille'],      badAgainst: ['Morgana', 'Lulu', 'Brand', 'Milio'] },
  Soraka:      { goodAgainst: ['MissFortune', 'Caitlyn', 'Sivir', 'Karma'],                  badAgainst: ['Blitzcrank', 'Leona', 'Pyke', 'Thresh', 'Nautilus'] },
  Janna:       { goodAgainst: ['Leona', 'Nautilus', 'Pyke', 'Pantheon', 'Alistar', 'Blitzcrank'], badAgainst: ['Morgana', 'Soraka', 'Lulu', 'Milio'] },
  Lulu:        { goodAgainst: ['Leona', 'Nautilus', 'Pyke', 'Pantheon', 'Alistar'],          badAgainst: ['Morgana', 'Brand', 'Zyra', 'Blitzcrank'] },
  Leona:       { goodAgainst: ['Soraka', 'Sona', 'Yuumi', 'Karma', 'Lux'],                   badAgainst: ['Janna', 'Morgana', 'Lulu', 'Milio'] },
  Pyke:        { goodAgainst: ['Soraka', 'Sona', 'Yuumi', 'Karma'],                          badAgainst: ['Morgana', 'Janna', 'Lux', 'Pantheon', 'Zilean'] },
  Nami:        { goodAgainst: ['Leona', 'Nautilus', 'Pyke', 'Soraka', 'Sona'],               badAgainst: ['Morgana', 'Lulu', 'Milio', 'Brand'] },
};

const DEFAULT_FALLBACK_CHAMPION = 'Jinx';

// Lookup O(1) sobre el catálogo — `findChampion('Lucian') → {role,damageType…}`.
const CHAMPION_BY_ID = CHAMPIONS.reduce((acc, c) => {
  acc[c.id] = c;
  return acc;
}, {});

function asCanonicalName(c) {
  if (!c) return null;
  if (typeof c === 'string') return c;
  return c.id || c.displayName || c.championId || null;
}

function normalizeUserPool(pool) {
  if (!pool) return [];
  if (Array.isArray(pool)) return pool.map(asCanonicalName).filter(Boolean);
  // {main:[], secondary:[]} — main primero, luego secondary.
  const main = Array.isArray(pool.main) ? pool.main : [];
  const sec  = Array.isArray(pool.secondary) ? pool.secondary
              : Array.isArray(pool.sec) ? pool.sec : [];
  return [...main, ...sec].map(asCanonicalName).filter(Boolean);
}

/**
 * Analiza la composición del equipo enemigo y devuelve flags estratégicos.
 *
 * Salida:
 * {
 * adCount, apCount, meleeCount, rangedCount,
 * isAdHeavy, isApHeavy, isMeleeHeavy,
 * hasEngage, hasHyperCarry, hasPokeSiege, hasBurstPick,
 * hasSplitPush, hasSustained,
 * enemyByRole, tags: string[]
 * }
 *
 * Reglas:
 * "Heavy" = mayoría 60% o más de ese tipo (con al menos 3 picks).
 * Cada `has*` flag se activa con UN solo champion del set (los arquetipos
 * son tan determinantes que un solo pick ya marca la comp).
 * `tags` agrega los flags activos para inspección rápida (debug + UI).
 *
 * Los sets están curados a mano sobre el catálogo `championsCatalog.js`. En
 * producción vendrían de un dataset externo (Lolalytics tier list, datos
 * profesionales). Para el TFG son suficientes los arquetipos canónicos.
 */
const HARD_ENGAGE_CHAMPIONS = new Set([
  'Malphite', 'Leona', 'Nautilus', 'Amumu', 'Sejuani', 'Hecarim',
  'JarvanIV', 'Vi', 'Rell', 'Rakan', 'Gragas', 'Alistar',
]);

// Campeones que escalan brutalmente con items y tiempo. Si el enemigo tiene
// uno, hay que cerrar la partida temprano para no perder en late.
const HYPER_CARRY_CHAMPIONS = new Set([
  'Vayne', 'Jinx', 'Kayle', 'Kassadin', 'KogMaw', 'Veigar', 'Tristana',
  'Twitch', 'Karthus', 'Nasus',
]);

// Comps que poke desde lejos — siege seguro, daño previo al engage.
const POKE_SIEGE_CHAMPIONS = new Set([
  'Jayce', 'Ziggs', 'Varus', 'Caitlyn', 'Xerath', 'Lux', 'Ashe', 'Ezreal',
  'Nidalee',
]);

// Asesinos que one-shot al carry. Vulnerable a peel + tanks con health.
const BURST_PICK_CHAMPIONS = new Set([
  'Zed', 'Talon', 'LeBlanc', 'Fizz', 'Akali', 'Katarina', 'KhaZix',
  'Rengar', 'Diana', 'Qiyana', 'Pyke',
]);

// Splitpushers — fuerzan side waves, ganan 1v1, presionan torre.
const SPLIT_PUSH_CHAMPIONS = new Set([
  'Tryndamere', 'Fiora', 'Camille', 'Jax', 'Yorick', 'Olaf', 'Trundle',
  'Riven', 'Yi', 'MasterYi',
]);

// Comps con healing/drain alto — necesitas Grievous Wounds.
const SUSTAINED_CHAMPIONS = new Set([
  'Aatrox', 'Soraka', 'Yuumi', 'Vladimir', 'Swain', 'Olaf', 'Warwick',
  'Dr. Mundo', 'DrMundo', 'Renekton', 'Sett',
]);

function analyzeEnemyComposition(enemyPicks) {
  const summary = {
    adCount: 0, apCount: 0, mixedCount: 0,
    meleeCount: 0, rangedCount: 0,
    isAdHeavy: false, isApHeavy: false, isMeleeHeavy: false,
    hasEngage: false,
    hasHyperCarry: false, hasPokeSiege: false, hasBurstPick: false,
    hasSplitPush: false, hasSustained: false,
    enemyByRole: { TOP: 0, JUNGLE: 0, MID: 0, ADC: 0, SUPPORT: 0 },
    tags: [],
  };

  if (!Array.isArray(enemyPicks) || enemyPicks.length === 0) return summary;

  for (const pick of enemyPicks) {
    // Los archetype-sets se evalúan SIEMPRE (no dependen del catálogo
    // championsCatalog) — Jayce, Vladimir, Aatrox, etc. son arquetipos
    // canónicos del meta aunque no estén todos en CHAMPIONS.
    if (HARD_ENGAGE_CHAMPIONS.has(pick))   summary.hasEngage     = true;
    if (HYPER_CARRY_CHAMPIONS.has(pick))   summary.hasHyperCarry = true;
    if (POKE_SIEGE_CHAMPIONS.has(pick))    summary.hasPokeSiege  = true;
    if (BURST_PICK_CHAMPIONS.has(pick))    summary.hasBurstPick  = true;
    if (SPLIT_PUSH_CHAMPIONS.has(pick))    summary.hasSplitPush  = true;
    if (SUSTAINED_CHAMPIONS.has(pick))     summary.hasSustained  = true;

    // El resto (counts AD/AP, melee/ranged, role) requieren metadata del
    // catálogo — si el pick no está, lo saltamos en estos counts.
    const meta = CHAMPION_BY_ID[pick];
    if (!meta) continue;
    if (meta.damageType === 'AD')    summary.adCount++;
    if (meta.damageType === 'AP')    summary.apCount++;
    if (meta.damageType === 'MIXED') summary.mixedCount++;
    if (meta.ranged) summary.rangedCount++; else summary.meleeCount++;
    if (summary.enemyByRole[meta.role] !== undefined) summary.enemyByRole[meta.role]++;
  }

  const total = enemyPicks.length;
  if (total >= 3) {
    summary.isAdHeavy    = summary.adCount    / total >= 0.6;
    summary.isApHeavy    = summary.apCount    / total >= 0.6;
    summary.isMeleeHeavy = summary.meleeCount / total >= 0.6;
  }

  // Resumen agregado de tags activos. Útil para debug y para que el
  // frontend pueda etiquetar la comp ("Comp enemiga: HYPER_CARRY + POKE").
  if (summary.isAdHeavy)     summary.tags.push('AD_HEAVY');
  if (summary.isApHeavy)     summary.tags.push('AP_HEAVY');
  if (summary.isMeleeHeavy)  summary.tags.push('MELEE_HEAVY');
  if (summary.hasEngage)     summary.tags.push('HEAVY_ENGAGE');
  if (summary.hasHyperCarry) summary.tags.push('HYPER_CARRY');
  if (summary.hasPokeSiege)  summary.tags.push('POKE_SIEGE');
  if (summary.hasBurstPick)  summary.tags.push('BURST_PICK');
  if (summary.hasSplitPush)  summary.tags.push('SPLIT_PUSH');
  if (summary.hasSustained)  summary.tags.push('SUSTAINED');

  return summary;
}

/**
 * Calcula un bonus por composición. Premia campeones que counterean
 * tendencias del equipo enemigo, no solo la lane individual.
 *
 * AD_HEAVY → tanks con armor scaling (Malphite) o AP que ignoran armor.
 * AP_HEAVY → AD daño y tanks con MR (Galio, Sivir).
 * HEAVY_ENGAGE→ peel/disengage (Lulu, Janna, Thresh, Morgana).
 * MELEE_HEAVY → ranged kiteo (Caitlyn, Vayne, Ezreal).
 * HYPER_CARRY → early pressure / stomp pickers (Zed, Pantheon, Renekton).
 * POKE_SIEGE → engage/dive (Malphite, Amumu, Sejuani, Hecarim).
 * BURST_PICK → tanks/health-stack (Sion equiv) o utility (Lulu Wild Growth).
 * SPLIT_PUSH → globales / waveclear (TF, Pantheon, Galio, Shen).
 * SUSTAINED → presión anti-heal (Morgana root + GW item, Caitlyn poke).
 */
const COMP_COUNTERS = {
  // Counter al daño físico → tanks AP con armor + AP que ignoran armor.
  AD_HEAVY: ['Malphite', 'Amumu', 'Galio', 'Sejuani', 'Lux', 'Syndra'],
  // Counter al daño mágico → AD daño + tanks con MR.
  AP_HEAVY: ['Sivir', 'Caitlyn', 'Lucian', 'Garen', 'Tryndamere'],
  // Disengage / peel contra hard engage.
  ENGAGE:   ['Lulu', 'Janna', 'Soraka', 'Nami', 'Morgana', 'Thresh'],
  // Kiteo contra equipo melee.
  MELEE_HEAVY: ['Caitlyn', 'Vayne', 'Ezreal', 'Jinx', 'Ashe'],
  // Early pressure / scaling stoppers — terminan la partida antes de que
  // el hyper-carry se complete.
  HYPER_CARRY: ['Zed', 'Pantheon', 'Renekton', 'Darius', 'LeeSin', 'KhaZix'],
  // Anti-poke: engage forzado o waveclear seguro.
  POKE_SIEGE:  ['Malphite', 'Amumu', 'Sejuani', 'Hecarim', 'JarvanIV', 'Vi'],
  // Anti-burst: tanks con health stacking o utilities con peel duro
  // (Lulu W "Whimsy" sobre el carry niega el one-shot).
  BURST_PICK:  ['Lulu', 'Janna', 'Thresh', 'Garen', 'Sion', 'Maokai',
                'Ornn', 'Nautilus'],
  // Anti-splitpush: globales (TF, Pantheon, Shen, Galio) o
  // duelistas que ganan el sidelane.
  SPLIT_PUSH:  ['TwistedFate', 'Pantheon', 'Galio', 'Shen', 'Fiora',
                'Camille', 'Jax'],
  // Anti-sustain: campeones con anti-heal innato o que castigan healing
  // (Morgana root + GW, Caitlyn poke desde lejos).
  SUSTAINED:   ['Morgana', 'Caitlyn', 'KaiSa', 'Tristana', 'KhaZix',
                'Renekton'],
};

function compositionBonus(champ, enemySummary) {
  let bonus = 0;
  const reasons = [];
  if (enemySummary.isAdHeavy && COMP_COUNTERS.AD_HEAVY.includes(champ)) {
    bonus += 1.5;
    reasons.push('counter al daño físico enemigo');
  }
  if (enemySummary.isApHeavy && COMP_COUNTERS.AP_HEAVY.includes(champ)) {
    bonus += 1.5;
    reasons.push('counter al daño mágico enemigo');
  }
  if (enemySummary.hasEngage && COMP_COUNTERS.ENGAGE.includes(champ)) {
    bonus += 1.0;
    reasons.push('peel/disengage contra hard engage');
  }
  if (enemySummary.isMeleeHeavy && COMP_COUNTERS.MELEE_HEAVY.includes(champ)) {
    bonus += 1.0;
    reasons.push('kiteo contra equipo melee');
  }
  // Nuevos arquetipos
  if (enemySummary.hasHyperCarry && COMP_COUNTERS.HYPER_CARRY.includes(champ)) {
    bonus += 1.2;
    reasons.push('early pressure contra hyper-carry');
  }
  if (enemySummary.hasPokeSiege && COMP_COUNTERS.POKE_SIEGE.includes(champ)) {
    bonus += 1.0;
    reasons.push('engage forzado contra poke');
  }
  if (enemySummary.hasBurstPick && COMP_COUNTERS.BURST_PICK.includes(champ)) {
    bonus += 1.0;
    reasons.push('peel anti-asesino');
  }
  if (enemySummary.hasSplitPush && COMP_COUNTERS.SPLIT_PUSH.includes(champ)) {
    bonus += 0.8;
    reasons.push('global/duelist contra splitpush');
  }
  if (enemySummary.hasSustained && COMP_COUNTERS.SUSTAINED.includes(champ)) {
    bonus += 0.8;
    reasons.push('castigo anti-sustain');
  }
  return { bonus, reasons };
}

/**
 * Puntúa UN campeón contra el contexto enemigo. Helper puro extraído del bucle
 * de `recommendPick` para que tanto el motor original como la nueva
 * `recommendFromPool` usen LA MISMA escala de score (cero divergencia).
 *
 * Componentes del score (escala "cruda", aditiva, pensada para ~[-3, +5]):
 * matchupScore : +1 por cada enemigo en goodAgainst, −1 por cada badAgainst.
 * compBonusPts : +0.8…+1.5 por arquetipo de comp enemiga counterado.
 * wrBonus : ±1 en torno al 50% de winrate del usuario (cap ±1).
 * safetyBonus : NO entra en `score`; solo desempata (rangeds vs comps
 * hostiles + tener entrada en MATCHUP_TABLE).
 *
 * @returns {{ champ, good:string[], bad:string[], score:number,
 * compReasons:string[], compBonusPts:number, matchupScore:number,
 * safetyBonus:number }}
 */
function scoreChampionAgainst(champ, enemyPicks, enemySummary, userStats = {}) {
  const table = MATCHUP_TABLE[champ] || { goodAgainst: [], badAgainst: [] };
  const good  = (enemyPicks || []).filter(e => table.goodAgainst.includes(e));
  const bad   = (enemyPicks || []).filter(e => table.badAgainst.includes(e));
  const matchupScore = good.length - bad.length;
  const { bonus: compBonusPts, reasons: compReasons } = compositionBonus(champ, enemySummary);
  // WR del usuario añade ±1pt en torno al 50% (cap ±1).
  const wr = userStats[champ]?.wr ?? 50;
  const wrBonus = Math.max(-1, Math.min(1, (wr - 50) / 25));
  const score = matchupScore + compBonusPts + wrBonus;
  // safetyBonus: NO se añade al score visible. Sirve solo como tiebreaker
  // cuando el pool es pequeño y nada puntúa — los rangeds ganan a melees
  // contra comps hostiles (engage/burst/melee), reflejando la heurística
  // "si no tienes counter directo, al menos no te suicidaste con un
  // cuerpo a cuerpo". Cobertura en MATCHUP_TABLE también desempata: un
  // champion con datos en la tabla es preferible a uno desconocido.
  const meta = CHAMPION_BY_ID[champ];
  let safetyBonus = 0;
  if (meta?.ranged && (enemySummary.hasBurstPick || enemySummary.hasEngage || enemySummary.isMeleeHeavy)) {
    safetyBonus += 0.5;
  }
  if (MATCHUP_TABLE[champ]) safetyBonus += 0.1;
  return { champ, good, bad, score, compReasons, compBonusPts, matchupScore, safetyBonus };
}

/**
 * Recomienda el mejor pick del pool del usuario dado el estado del champion select.
 *
 * @param {string[]} enemyPicks - Campeones enemigos ya seleccionados (PascalCase).
 * @param {string[]|{main:[], secondary:[]}} userPool - Pool del usuario.
 * @param {Object} [opts]
 * @param {Object} [opts.userStats] - { [championName]: { wr, games } }.
 * @param {string} [opts.selectedRole] - 'TOP'|'JUNGLE'|'MID'|'ADC'|'SUPPORT'.
 * @param {string[]} [opts.allyPicks] - Picks aliados. Reservado para lógica
 * futura de sinergias; no afecta al
 * scoring todavía.
 * @returns {{
 * champion: string,
 * reason: string,
 * confidence: 'HIGH'|'MEDIUM'|'LOW',
 * detail: { goodMatchups: string[], badMatchups: string[],
 * compReasons: string[], score: number }
 * }}
 */
export function recommendPick(enemyPicks, userPool, opts = {}) {
  // Compatibilidad con la firma antigua `(enemyPicks, userPool, userStats)`:
  // la actual es `opts = { userStats, selectedRole, allyPicks }`. Si llega un
  // objeto sin esas tres keys, lo tratamos como el userStats de la firma vieja.
  let userStats = opts.userStats;
  let selectedRole = opts.selectedRole;
  // `allyPicks` se acepta pero todavía no influye en el scoring. Queda en la
  // firma para soportar futuras heurísticas de sinergia (evitar overlap de
  // roles, premiar engage si el aliado pickeó un peeler, etc.).
  // eslint-disable-next-line no-unused-vars
  const allyPicks = Array.isArray(opts.allyPicks) ? opts.allyPicks : [];
  if (opts && !userStats && !selectedRole && opts.allyPicks === undefined && typeof opts === 'object') {
    userStats = opts;
  }
  userStats = userStats || {};

  const pool = normalizeUserPool(userPool);

  if (pool.length === 0) {
    return {
      champion:   DEFAULT_FALLBACK_CHAMPION,
      reason:     'No hay pool configurado. Recomendando un pick versátil.',
      confidence: 'LOW',
      detail: { goodMatchups: [], badMatchups: [], compReasons: [], enemyTags: [], score: 0 },
    };
  }

  const enemySummary = analyzeEnemyComposition(enemyPicks);

  // Si hay rol elegido, filtramos el pool a los campeones jugables en ese rol
  // (primario o secundario). Así los flex picks —Yasuo MID+TOP, Lucian ADC+MID,
  // Sett TOP+SUPPORT…— no se excluyen cuando el usuario filtra por rol.
  let scoredPool = pool;
  if (selectedRole) {
    const roleMatches = pool.filter(id => {
      const meta = CHAMPION_BY_ID[id];
      if (!meta) return false;
      if (meta.role === selectedRole) return true;
      // secondaryRoles es opcional — si no está, no matchea.
      return Array.isArray(meta.secondaryRoles)
        && meta.secondaryRoles.includes(selectedRole);
    });
    if (roleMatches.length > 0) scoredPool = roleMatches;
  }

  if (!enemyPicks || enemyPicks.length === 0) {
    const best = scoredPool[0];
    const wr   = userStats[best]?.wr ?? 55;
    const meta = CHAMPION_BY_ID[best];
    const roleSuffix = selectedRole && meta?.role === selectedRole
      ? ` Encaja con el rol elegido (${selectedRole}).`
      : '';
    return {
      champion:   best,
      reason:     `Tu campeón más dominado. WR estimado ${wr}%. Ideal para forzar partida.${roleSuffix}`,
      confidence: 'MEDIUM',
      detail: { goodMatchups: [], badMatchups: [], compReasons: [], score: 0 },
    };
  }

  // Puntuar cada champion del pool: matchup 1v1 + bonus por comp + bonus por rol.
  // El cálculo por campeón vive en `scoreChampionAgainst` (helper puro extraído
  // para que `recommendFromPool` pueda reutilizar EXACTAMENTE la misma escala).
  const scored = scoredPool.map(champ =>
    scoreChampionAgainst(champ, enemyPicks, enemySummary, userStats)
  );

  // Sort principal por score, con tiebreakers para evitar el bug de "siempre
  // gana el primero del array" cuando el pool no tiene cobertura: preferimos
  // (1) mejor compBonus, (2) mejor matchup, (3) safetyBonus, (4) tener
  // entrada en MATCHUP_TABLE (último recurso).
  scored.sort((a, b) => {
    if (b.score !== a.score)             return b.score - a.score;
    if (b.compBonusPts !== a.compBonusPts) return b.compBonusPts - a.compBonusPts;
    if (b.matchupScore !== a.matchupScore) return b.matchupScore - a.matchupScore;
    if (b.safetyBonus !== a.safetyBonus)   return b.safetyBonus - a.safetyBonus;
    return 0;
  });
  const top = scored[0];

  // Confianza: HIGH si ≥2 buenos matchups o (≥1 matchup + 1 comp counter);
  // MEDIUM si exactamente 1 matchup o algún comp counter; LOW si nada.
  let confidence = 'LOW';
  if (top.good.length >= 2 || (top.good.length >= 1 && top.compReasons.length >= 1)) {
    confidence = 'HIGH';
  } else if (top.good.length === 1 || top.compReasons.length >= 1) {
    confidence = 'MEDIUM';
  }

  // Construcción del reason: si hay compReasons las incluimos SIEMPRE, no
  // solo cuando no hay matchup. Es la información estratégica más útil
  // cuando el pool no tiene cobertura 1v1 contra arquetipos enemigos.
  let reason;
  if (top.good.length > 0 && top.compReasons.length > 0) {
    reason = `Buen matchup contra ${top.good.join(', ')}. ${capitalize(top.compReasons[0])}.`;
    if (top.bad.length > 0) reason += ` Cuidado con ${top.bad.join(', ')}.`;
  } else if (top.good.length > 0) {
    reason = `Buen matchup contra ${top.good.join(', ')}.`;
    if (top.bad.length > 0) reason += ` Cuidado con ${top.bad.join(', ')}.`;
  } else if (top.compReasons.length > 0) {
    reason = `${capitalize(top.compReasons[0])} de la comp enemiga.`;
    if (top.bad.length > 0) reason += ` Cuidado con ${top.bad.join(', ')}.`;
  } else if (enemySummary.tags.length > 0) {
    // No hay matchup ni comp counter directo, pero la comp enemiga tiene
    // arquetipos identificados — exponerlos es mejor que la frase vacía.
    reason = `Pool sin counter directo a la comp enemiga (${enemySummary.tags.join(' · ')}). Pick más fiable del pool.`;
    if (top.bad.length > 0) reason += ` Cuidado con ${top.bad.join(', ')}.`;
  } else if (top.bad.length > 0) {
    reason = `Sin counters claros, pero evita exponerte a ${top.bad.join(', ')}.`;
  } else {
    reason = 'Sin matchups directos en el enemigo. Tu pick más fiable del pool.';
  }

  return {
    champion:   top.champ,
    reason,
    confidence,
    detail: {
      goodMatchups: top.good,
      badMatchups:  top.bad,
      compReasons:  top.compReasons,
      enemyTags:    enemySummary.tags,
      score:        Number(top.score.toFixed(2)),
    },
  };
}

function capitalize(s) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ============================================================================
// Recomendación CONSCIENTE DEL POOL + counter de catálogo
// ----------------------------------------------------------------------------
// `recommendPick` (arriba) responde "qué pick del pool es el mejor". Pero NO
// dice nada sobre la CALIDAD ABSOLUTA de ese pick respecto al enemigo: si el
// pool del usuario no cubre la comp rival, igualmente devuelve "el menos malo"
// sin avisar de que hay un HUECO. `recommendFromPool` añade exactamente eso:
//
// 1. Normaliza el score crudo del motor (~[-3,+5]) a 0-100 para poder fijar
// umbrales legibles y mostrarlos en la UI.
// 2. Distingue, si el pool trae info de slots (modelo "pool 2+2"), los
// campeones en huecos DESBLOQUEADOS de los BLOQUEADOS (nivel Nova Rift).
// 3. Clasifica el resultado en POOL_STRONG / POOL_OK / POOL_GAP y, en el
// caso GAP, BUSCA EN EL CATÁLOGO el mejor counter al enemigo de esa
// posición — aunque el usuario no lo tenga — para sugerir aprenderlo.
//
// Es ADITIVA: no toca `recommendPick` ni su firma. La UI puede llamar a una u
// otra (o a ambas). 100% pura.
// ============================================================================

// ─── Umbrales de fuerza del pool (calibrados a la escala REAL del motor) ────
// Justificación de la escala: en `scoreChampionAgainst` un pick puntúa
// +1 por matchup favorable directo (goodAgainst)
// +0.8…+1.5 por arquetipo de comp counterado
// ±1 por winrate
// Un pick "fuerte de verdad" suele combinar ≥2 señales: p.ej. Garen vs comp
// con Malphite = matchup +1 y AP_HEAVY +1.5 → score crudo 2.5. Un pick "ok"
// tiene UNA señal (~1.0–1.5). Sin cobertura, el score cae a ≤0.
//
// Mapeamos ese rango crudo a 0-100 con `normalizeScore` (ver abajo): el punto
// neutro (score crudo 0) cae en 50, y +4 crudo satura a ~100. Con esa función:
// score crudo 2.5 → ≈81 → STRONG
// score crudo 1.2 → ≈65 → OK
// score crudo 0.0 → 50 → GAP (no hay ventaja real)
// De ahí los cortes:
const POOL_STRONG_THRESHOLD = 72; // ≈ score crudo ≥2.0 (matchup + comp, o 2 matchups)
const POOL_OK_THRESHOLD     = 58; // ≈ score crudo ≥1.0 (una señal clara de ventaja)
// Por debajo de POOL_OK_THRESHOLD ⇒ POOL_GAP (el pool no responde a la comp).

/**
 * Normaliza el score crudo del motor (~[-3,+5]) a una escala 0-100 alineada
 * con la confianza que transmite. Diseño:
 * score 0 (sin ventaja ni desventaja) → 50 (neutro).
 * cada punto crudo positivo suma ~12.5 hasta saturar en 100 (≈ +4 crudo).
 * cada punto crudo negativo resta hasta 0 (≈ −4 crudo).
 * Es una rampa lineal recortada: simple, explicable y monótona (más score
 * crudo ⇒ más score normalizado), que es lo único que necesitan los umbrales.
 *
 * @param {number} raw score crudo de scoreChampionAgainst
 * @returns {number} entero 0-100
 */
function normalizeScore(raw) {
  const SCALE = 12.5;                 // 4 puntos crudos cubren medio rango (50→100)
  const v = 50 + (raw || 0) * SCALE;
  return Math.max(0, Math.min(100, Math.round(v)));
}

/**
 * Aplana el pool del usuario conservando, cuando existe, la información de slot
 * (main/secondary) y de bloqueo. Acepta los MISMOS formatos que el resto de la
 * app más el shape "rico" de ChampionPickScreen (`{championId, slot, priority}`):
 *
 * string → 'Lucian'
 * { id|championId|displayName } → objeto de campeón
 * { ..., slot:'main'|'secondary' }→ marca el slot
 * { ..., locked:true } → hueco bloqueado del modelo 2+2
 * { main:[...], secondary:[...] } → objeto agrupado
 *
 * @returns {{ id:string, slot:'main'|'secondary'|null, locked:boolean }[]}
 */
function normalizePoolEntries(pool) {
  if (!pool) return [];

  const toEntry = (c, slotHint = null) => {
    const id = asCanonicalName(c);
    if (!id) return null;
    // Si el item es objeto, respetamos su slot/locked; si es string, slotHint.
    const isObj = c && typeof c === 'object';
    const slot = isObj ? (c.slot || slotHint || null) : (slotHint || null);
    const locked = isObj ? Boolean(c.locked) : false;
    return { id, slot, locked };
  };

  // Objeto agrupado { main:[], secondary:[] }
  if (!Array.isArray(pool) && typeof pool === 'object') {
    const main = Array.isArray(pool.main) ? pool.main : [];
    const sec  = Array.isArray(pool.secondary) ? pool.secondary
                : Array.isArray(pool.sec) ? pool.sec : [];
    return [
      ...main.map(c => toEntry(c, 'main')),
      ...sec.map(c => toEntry(c, 'secondary')),
    ].filter(Boolean);
  }

  // Array (de strings y/o objetos {championId, slot, locked, ...})
  if (Array.isArray(pool)) return pool.map(c => toEntry(c)).filter(Boolean);

  return [];
}

/**
 * Filtra las entradas del pool jugables en `role` (primario o secundario del
 * catálogo). Si no hay rol, devuelve todas. Reutiliza la metadata de
 * `championsCatalog` igual que `recommendPick`.
 */
function poolEntriesForRole(entries, role) {
  if (!role) return entries;
  const matches = entries.filter(({ id }) => {
    const meta = CHAMPION_BY_ID[id];
    if (!meta) return false;
    if (meta.role === role) return true;
    return Array.isArray(meta.secondaryRoles) && meta.secondaryRoles.includes(role);
  });
  // Si el rol no matchea nada del pool, NO forzamos fallback aquí: que el rol
  // no esté cubierto es justamente una señal de GAP que el caller querrá ver.
  return matches;
}

/**
 * Busca en TODO el catálogo el mejor counter contra el contexto enemigo para
 * un rol dado, EXCLUYENDO lo que el usuario ya tiene en el pool. Sirve para el
 * caso POOL_GAP: "tu pool no cubre esto; el counter sería X".
 *
 * Criterio de counter (en orden de prioridad dentro del score crudo reutilizado):
 * 1. goodAgainst directo contra algún enemigo (matchupScore alto).
 * 2. counter de arquetipo de comp (compBonus).
 * 3. desempates de seguridad (ranged vs comp hostil, cobertura en tabla).
 * Además exigimos que el campeón sea del rol pedido (primario o secundario).
 *
 * @returns {{ champion:string, score:number, reason:string }|null}
 */
function findCatalogCounter(enemyPicks, enemySummary, role, excludeIds = []) {
  const exclude = new Set(excludeIds);
  const candidates = CHAMPIONS.filter(c => {
    if (exclude.has(c.id)) return false;
    if (!role) return true;
    if (c.role === role) return true;
    return Array.isArray(c.secondaryRoles) && c.secondaryRoles.includes(role);
  });
  if (candidates.length === 0) return null;

  const scored = candidates
    .map(c => scoreChampionAgainst(c.id, enemyPicks, enemySummary, {}))
    .sort((a, b) => {
      if (b.score !== a.score)               return b.score - a.score;
      if (b.matchupScore !== a.matchupScore) return b.matchupScore - a.matchupScore;
      if (b.compBonusPts !== a.compBonusPts) return b.compBonusPts - a.compBonusPts;
      return b.safetyBonus - a.safetyBonus;
    });

  const best = scored[0];
  // Solo proponemos el counter si APORTA ventaja real (matchup o comp). Si ni
  // el mejor del catálogo countera nada, no merece la pena sugerir "aprende X".
  if (!best || (best.matchupScore <= 0 && best.compBonusPts <= 0)) return null;

  // Construimos una razón centrada en CONTRA QUIÉN va bien.
  let reason;
  if (best.good.length > 0) {
    reason = `fuerte contra ${best.good.join(', ')}`;
  } else if (best.compReasons.length > 0) {
    reason = best.compReasons[0];
  } else {
    reason = 'mejor respuesta del catálogo a esta comp';
  }
  return { champion: best.champ, score: normalizeScore(best.score), reason };
}

/**
 * Recomendación CONSCIENTE DEL POOL.
 *
 * Toma el pool del usuario para una posición, lo puntúa contra el contexto
 * enemigo con la MISMA escala que `recommendPick`, y decide si el pool RESPONDE
 * a la partida (STRONG/OK) o tiene un HUECO (GAP) — en cuyo caso busca el mejor
 * counter del catálogo para que el usuario se plantee aprenderlo.
 *
 * @param {string[]|object[]|{main:[],secondary:[]}} userPool - Pool del usuario.
 * Acepta strings, objetos {championId, slot, locked, priority} (shape de
 * ChampionPickScreen) u objeto agrupado {main, secondary}.
 * @param {string} role - 'TOP'|'JUNGLE'|'MID'|'ADC'|'SUPPORT' (o null = todo el pool).
 * @param {object} enemyContext
 * @param {string[]} [enemyContext.enemyPicks] - Picks enemigos (PascalCase).
 * @param {object} [opts]
 * @param {object} [opts.userStats] - { [championName]: { wr, games } }.
 * @param {number} [opts.strongThreshold] - override del umbral STRONG (0-100).
 * @param {number} [opts.okThreshold] - override del umbral OK (0-100).
 *
 * @returns {{
 * pick: { champion:string, score:number, fromPool:boolean,
 * reason:string, slot:('main'|'secondary'|null), unlockHint?:string } | null,
 * poolStrength: 'STRONG'|'OK'|'GAP',
 * counter?: { champion:string, score:number, reason:string, inPool:false },
 * detail: { rawScore:number, goodMatchups:string[], badMatchups:string[],
 * compReasons:string[], enemyTags:string[], roleCovered:boolean }
 * }}
 */
export function recommendFromPool(userPool, role, enemyContext = {}, opts = {}) {
  const enemyPicks   = Array.isArray(enemyContext.enemyPicks) ? enemyContext.enemyPicks
                     : Array.isArray(enemyContext) ? enemyContext // tolera pasar el array directo
                     : [];
  const userStats    = opts.userStats || {};
  const strongCut    = typeof opts.strongThreshold === 'number' ? opts.strongThreshold : POOL_STRONG_THRESHOLD;
  const okCut        = typeof opts.okThreshold === 'number' ? opts.okThreshold : POOL_OK_THRESHOLD;

  const enemySummary = analyzeEnemyComposition(enemyPicks);

  // 1. Entradas del pool jugables en el rol pedido (conservando slot/locked).
  const allEntries  = normalizePoolEntries(userPool);
  const roleEntries = poolEntriesForRole(allEntries, role);
  const roleCovered = roleEntries.length > 0;

  // Helper para empaquetar el bloque `detail` (mismo en todas las ramas).
  const buildDetail = (best) => ({
    rawScore:     best ? Number(best.score.toFixed(2)) : 0,
    goodMatchups: best ? best.good : [],
    badMatchups:  best ? best.bad : [],
    compReasons:  best ? best.compReasons : [],
    enemyTags:    enemySummary.tags,
    roleCovered,
  });

  // ── Caso A: el usuario NO tiene campeón de ese rol en el pool → GAP directo.
  if (!roleCovered) {
    const counter = findCatalogCounter(enemyPicks, enemySummary, role, allEntries.map(e => e.id));
    return {
      pick: null,
      poolStrength: 'GAP',
      ...(counter ? { counter: { ...counter, inPool: false,
        reason: `tu pool no cubre esta posición; el counter sería ${counter.champion} — plantéate aprenderlo/añadirlo a tu pool` } } : {}),
      detail: buildDetail(null),
    };
  }

  // 2. Puntuar cada entrada del rol con la escala del motor.
  // `entry` arrastra slot/locked; lo fusionamos con el score.
  const scored = roleEntries
    .map(entry => ({ entry, ...scoreChampionAgainst(entry.id, enemyPicks, enemySummary, userStats) }))
    .sort((a, b) => {
      if (b.score !== a.score)               return b.score - a.score;
      if (b.compBonusPts !== a.compBonusPts) return b.compBonusPts - a.compBonusPts;
      if (b.matchupScore !== a.matchupScore) return b.matchupScore - a.matchupScore;
      return b.safetyBonus - a.safetyBonus;
    });

  const best       = scored[0];
  const normalized = normalizeScore(best.score);

  // 3. Construir la razón del pick (reutiliza el estilo de recommendPick).
  let reason;
  if (best.good.length > 0 && best.compReasons.length > 0) {
    reason = `fuerte contra ${best.good.join(', ')} · ${best.compReasons[0]}`;
  } else if (best.good.length > 0) {
    reason = `fuerte contra ${best.good.join(', ')}`;
  } else if (best.compReasons.length > 0) {
    reason = best.compReasons[0];
  } else {
    reason = 'pick más fiable de tu pool para esta posición';
  }

  // Hint de desbloqueo si el mejor pick está en un hueco bloqueado del 2+2.
  const unlockHint = best.entry.locked
    ? 'está en un hueco bloqueado de tu pool; desbloquéalo jugando con NOVA RIFT'
    : undefined;

  const pick = {
    champion: best.entry.id,
    score:    normalized,
    fromPool: true,
    reason,
    slot:     best.entry.slot || null,
    ...(unlockHint ? { unlockHint } : {}),
  };

  // 4. Clasificar la fuerza del pool y, si es GAP, buscar counter de catálogo.
  if (normalized >= strongCut) {
    // POOL_STRONG: el pool responde con solvencia.
    return { pick, poolStrength: 'STRONG', detail: buildDetail(best) };
  }

  if (normalized >= okCut) {
    // POOL_OK: aceptable pero no la respuesta óptima. Lo marcamos en la razón.
    return {
      pick: { ...pick, reason: `${reason} (aceptable, no es la respuesta óptima)` },
      poolStrength: 'OK',
      detail: buildDetail(best),
    };
  }

  // POOL_GAP: ningún campeón del pool llega al umbral. Recomendamos igualmente
  // el "menos malo" del pool (pick) PERO marcamos el hueco y sugerimos counter.
  const counter = findCatalogCounter(
    enemyPicks, enemySummary, role,
    allEntries.map(e => e.id) // excluye TODO lo que ya tiene el usuario
  );
  return {
    pick,                       // el menos malo del pool, por si decide quedarse
    poolStrength: 'GAP',
    ...(counter ? { counter: { ...counter, inPool: false,
      reason: `tu pool no cubre esto; el counter sería ${counter.champion} (${counter.reason}) — plantéate aprenderlo/añadirlo a tu pool` } } : {}),
    detail: buildDetail(best),
  };
}
