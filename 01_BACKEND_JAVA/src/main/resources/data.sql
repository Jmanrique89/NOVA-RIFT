-- ============================================================================
-- NOVA RIFT — Seed data para la Knowledge Base del Motor de Recomendación
-- Fase 1 — KB persistida en JPA/H2
-- ============================================================================
-- Las tablas son creadas por Hibernate (ddl-auto=create-drop).
-- Spring carga este script después gracias a:
--   spring.jpa.defer-datasource-initialization=true
--   spring.sql.init.mode=always
-- ============================================================================

-- ─── KB_CHAMPIONS (>= 5 campeones reales seed) ──────────────────────────────
INSERT INTO KB_CHAMPIONS (champion_id, patch_version, key_name, display_name, roles_csv, damage_profile)
VALUES (238, '14.24', 'Zed', 'Zed', 'ASSASSIN,FIGHTER', 'AD');

INSERT INTO KB_CHAMPIONS (champion_id, patch_version, key_name, display_name, roles_csv, damage_profile)
VALUES (157, '14.24', 'Yasuo', 'Yasuo', 'FIGHTER,ASSASSIN', 'AD');

INSERT INTO KB_CHAMPIONS (champion_id, patch_version, key_name, display_name, roles_csv, damage_profile)
VALUES (84, '14.24', 'Akali', 'Akali', 'ASSASSIN', 'AP');

INSERT INTO KB_CHAMPIONS (champion_id, patch_version, key_name, display_name, roles_csv, damage_profile)
VALUES (8, '14.24', 'Vladimir', 'Vladimir', 'MAGE,FIGHTER', 'AP');

INSERT INTO KB_CHAMPIONS (champion_id, patch_version, key_name, display_name, roles_csv, damage_profile)
VALUES (114, '14.24', 'Fiora', 'Fiora', 'FIGHTER', 'AD');

INSERT INTO KB_CHAMPIONS (champion_id, patch_version, key_name, display_name, roles_csv, damage_profile)
VALUES (245, '14.24', 'Ekko', 'Ekko', 'ASSASSIN,FIGHTER', 'AP');

INSERT INTO KB_CHAMPIONS (champion_id, patch_version, key_name, display_name, roles_csv, damage_profile)
VALUES (64, '14.24', 'LeeSin', 'Lee Sin', 'FIGHTER,JUNGLER', 'AD');

INSERT INTO KB_CHAMPIONS (champion_id, patch_version, key_name, display_name, roles_csv, damage_profile)
VALUES (412, '14.24', 'Thresh', 'Thresh', 'SUPPORT,TANK', 'MIXED');

INSERT INTO KB_CHAMPIONS (champion_id, patch_version, key_name, display_name, roles_csv, damage_profile)
VALUES (11, '14.24', 'MasterYi', 'Master Yi', 'FIGHTER,ASSASSIN', 'AD');

INSERT INTO KB_CHAMPIONS (champion_id, patch_version, key_name, display_name, roles_csv, damage_profile)
VALUES (99, '14.24', 'Lux', 'Lux', 'MAGE,SUPPORT', 'AP');

-- Bloque ampliado desde novarift_lol_research (Top, Jungle, Mid, ADC, Support
-- meta del patch 26.x — clasificación damage profile + role para que el motor
-- de scoring detecte mejor las amenazas reales)
INSERT INTO KB_CHAMPIONS (champion_id, patch_version, key_name, display_name, roles_csv, damage_profile) VALUES
 (266, '14.24', 'Aatrox',     'Aatrox',     'DIVER,FIGHTER',         'AD'),
 (122, '14.24', 'Darius',     'Darius',     'JUGGERNAUT,FIGHTER',    'AD'),
 (86,  '14.24', 'Garen',      'Garen',      'JUGGERNAUT,FIGHTER',    'AD'),
 (24,  '14.24', 'Jax',        'Jax',        'SKIRMISHER,FIGHTER',    'MIXED'),
 (54,  '14.24', 'Malphite',   'Malphite',   'TANK',                  'AP'),
 (516, '14.24', 'Ornn',       'Ornn',       'TANK',                  'AD'),
 (58,  '14.24', 'Renekton',   'Renekton',   'DIVER,FIGHTER',         'AD'),
 (92,  '14.24', 'Riven',      'Riven',      'DIVER,FIGHTER',         'AD'),
 (875, '14.24', 'Sett',       'Sett',       'JUGGERNAUT,FIGHTER',    'AD'),
 (23,  '14.24', 'Tryndamere', 'Tryndamere', 'SKIRMISHER,FIGHTER',    'AD'),
 (106, '14.24', 'Volibear',   'Volibear',   'DIVER,FIGHTER',         'MIXED'),
 (32,  '14.24', 'Amumu',      'Amumu',      'TANK,JUNGLER',          'AP'),
 (104, '14.24', 'Graves',     'Graves',     'MARKSMAN,JUNGLER',      'AD'),
 (120, '14.24', 'Hecarim',    'Hecarim',    'DIVER,JUNGLER',         'AD'),
 (59,  '14.24', 'JarvanIV',   'Jarvan IV',  'DIVER,JUNGLER',         'AD'),
 (141, '14.24', 'Kayn',       'Kayn',       'ASSASSIN,JUNGLER',      'AD'),
 (56,  '14.24', 'Nocturne',   'Nocturne',   'ASSASSIN,JUNGLER',      'AD'),
 (254, '14.24', 'Vi',         'Vi',         'DIVER,JUNGLER',         'AD'),
 (19,  '14.24', 'Warwick',    'Warwick',    'DIVER,JUNGLER',         'MIXED'),
 (5,   '14.24', 'XinZhao',    'Xin Zhao',   'DIVER,JUNGLER',         'AD'),
 (154, '14.24', 'Zac',        'Zac',        'TANK,JUNGLER',          'AP'),
 (103, '14.24', 'Ahri',       'Ahri',       'BURST_MAGE,MID',        'AP'),
 (55,  '14.24', 'Katarina',   'Katarina',   'ASSASSIN,MID',          'AP'),
 (7,   '14.24', 'LeBlanc',    'LeBlanc',    'ASSASSIN,MID',          'AP'),
 (61,  '14.24', 'Orianna',    'Orianna',    'BURST_MAGE,MID',        'AP'),
 (134, '14.24', 'Syndra',     'Syndra',     'BURST_MAGE,MID',        'AP'),
 (777, '14.24', 'Yone',       'Yone',       'SKIRMISHER,MID',        'MIXED'),
 (517, '14.24', 'Sylas',      'Sylas',      'BATTLE_MAGE,MID',       'AP'),
 (51,  '14.24', 'Caitlyn',    'Caitlyn',    'MARKSMAN,ADC',          'AD'),
 (119, '14.24', 'Draven',     'Draven',     'MARKSMAN,ADC',          'AD'),
 (222, '14.24', 'Jinx',       'Jinx',       'MARKSMAN,ADC',          'AD'),
 (145, '14.24', 'Kaisa',      'Kai''Sa',    'MARKSMAN,ADC',          'MIXED'),
 (236, '14.24', 'Lucian',     'Lucian',     'MARKSMAN,ADC',          'AD'),
 (110, '14.24', 'Varus',      'Varus',      'MARKSMAN,ADC',          'AD'),
 (67,  '14.24', 'Vayne',      'Vayne',      'MARKSMAN,ADC',          'AD'),
 (12,  '14.24', 'Alistar',    'Alistar',    'WARDEN,SUPPORT',        'AP'),
 (53,  '14.24', 'Blitzcrank', 'Blitzcrank', 'CATCHER,SUPPORT',       'AP'),
 (40,  '14.24', 'Janna',      'Janna',      'ENCHANTER,SUPPORT',     'AP'),
 (89,  '14.24', 'Leona',      'Leona',      'WARDEN,SUPPORT',        'AP'),
 (111, '14.24', 'Nautilus',   'Nautilus',   'WARDEN,SUPPORT',        'AP'),
 (16,  '14.24', 'Soraka',     'Soraka',     'ENCHANTER,SUPPORT',     'AP'),
 (350, '14.24', 'Yuumi',      'Yuumi',      'ENCHANTER,SUPPORT',     'AP');


-- ─── KB_ITEM_COUNTERS (>= 5 items reales seed) ──────────────────────────────
INSERT INTO KB_ITEM_COUNTERS (item_counter_id, patch_version, counter_item_id, counter_item_name, target_damage_profile, target_cc_profile, effectiveness_score, explanation, timing_window)
VALUES ('IC-001', '14.24', '3047', 'Plated Steelcaps', 'AD', 'LOW_CC', 85, 'Reduce dano de ataques basicos AD en un 12%', 'EARLY');

INSERT INTO KB_ITEM_COUNTERS (item_counter_id, patch_version, counter_item_id, counter_item_name, target_damage_profile, target_cc_profile, effectiveness_score, explanation, timing_window)
VALUES ('IC-002', '14.24', '3111', 'Mercury''s Treads', 'AP', 'HIGH_CC', 88, 'Tenacidad +30% y MR contra burst AP', 'EARLY');

INSERT INTO KB_ITEM_COUNTERS (item_counter_id, patch_version, counter_item_id, counter_item_name, target_damage_profile, target_cc_profile, effectiveness_score, explanation, timing_window)
VALUES ('IC-003', '14.24', '3157', 'Zhonya''s Hourglass', 'AD', 'LOW_CC', 92, 'Stasis 2.5s contra burst AD - counter critico de asesinos', 'MID');

INSERT INTO KB_ITEM_COUNTERS (item_counter_id, patch_version, counter_item_id, counter_item_name, target_damage_profile, target_cc_profile, effectiveness_score, explanation, timing_window)
VALUES ('IC-004', '14.24', '3110', 'Frozen Heart', 'AD', 'LOW_CC', 80, 'Reduce velocidad de ataque enemiga en area en 20%', 'MID');

INSERT INTO KB_ITEM_COUNTERS (item_counter_id, patch_version, counter_item_id, counter_item_name, target_damage_profile, target_cc_profile, effectiveness_score, explanation, timing_window)
VALUES ('IC-005', '14.24', '3143', 'Randuin''s Omen', 'AD', 'LOW_CC', 82, 'Reduce dano critico recibido en un 35%', 'MID');

INSERT INTO KB_ITEM_COUNTERS (item_counter_id, patch_version, counter_item_id, counter_item_name, target_damage_profile, target_cc_profile, effectiveness_score, explanation, timing_window)
VALUES ('IC-006', '14.24', '3156', 'Maw of Malmortius', 'AP', 'LOW_CC', 86, 'Escudo anti-AP al bajar de 50% HP - sobrevive el burst', 'MID');

INSERT INTO KB_ITEM_COUNTERS (item_counter_id, patch_version, counter_item_id, counter_item_name, target_damage_profile, target_cc_profile, effectiveness_score, explanation, timing_window)
VALUES ('IC-007', '14.24', '3026', 'Guardian Angel', 'AD', 'LOW_CC', 78, 'Resucita tras morir con 50% HP/Mana - clutch en teamfights', 'LATE');

INSERT INTO KB_ITEM_COUNTERS (item_counter_id, patch_version, counter_item_id, counter_item_name, target_damage_profile, target_cc_profile, effectiveness_score, explanation, timing_window)
VALUES ('IC-008', '14.24', '6333', 'Death''s Dance', 'AD', 'LOW_CC', 90, 'Convierte 30% del burst en DoT y cura - anti-asesino premium', 'MID');

INSERT INTO KB_ITEM_COUNTERS (item_counter_id, patch_version, counter_item_id, counter_item_name, target_damage_profile, target_cc_profile, effectiveness_score, explanation, timing_window)
VALUES ('IC-009', '14.24', '3140', 'Quicksilver Sash', 'AP', 'HIGH_CC', 75, 'Activo: limpia cualquier CC duro (incluido suppress)', 'MID');

INSERT INTO KB_ITEM_COUNTERS (item_counter_id, patch_version, counter_item_id, counter_item_name, target_damage_profile, target_cc_profile, effectiveness_score, explanation, timing_window)
VALUES ('IC-010', '14.24', '3165', 'Morellonomicon', 'AP', 'LOW_CC', 72, 'Anti-heal Grievous Wounds (40%) contra champs con sustain', 'MID');

INSERT INTO KB_ITEM_COUNTERS (item_counter_id, patch_version, counter_item_id, counter_item_name, target_damage_profile, target_cc_profile, effectiveness_score, explanation, timing_window)
VALUES ('IC-011', '14.24', '3102', 'Banshee''s Veil', 'AP', 'HIGH_CC', 79, 'Bloquea la primera habilidad enemiga - desperdicia engages', 'MID');

INSERT INTO KB_ITEM_COUNTERS (item_counter_id, patch_version, counter_item_id, counter_item_name, target_damage_profile, target_cc_profile, effectiveness_score, explanation, timing_window)
VALUES ('IC-012', '14.24', '3075', 'Thornmail', 'AD', 'LOW_CC', 77, 'Refleja 25% del dano fisico recibido + anti-heal', 'MID');

-- Bloque ampliado desde novarift_lol_research (anti-heal, anti-shield, poke
-- sustain, late-game spike — items relevantes en el meta del patch 26.x)
INSERT INTO KB_ITEM_COUNTERS (item_counter_id, patch_version, counter_item_id, counter_item_name, target_damage_profile, target_cc_profile, effectiveness_score, explanation, timing_window) VALUES
 ('IC-013', '14.24', '6609', 'Chempunk Chainsword',  'AD',    'LOW_CC',  84, 'Anti-heal AD (40% Grievous Wounds) + AD/HP - obligatorio vs Aatrox/Mundo/Sett', 'MID'),
 ('IC-014', '14.24', '3033', 'Mortal Reminder',      'AD',    'LOW_CC',  82, 'Anti-heal + 30% armor pen para ADCs vs healers', 'MID'),
 ('IC-015', '14.24', '6695', 'Serpent''s Fang',       'AD',    'LOW_CC',  78, 'Anti-shield AD (rompe escudos Janna/Lulu/Karma)', 'MID'),
 ('IC-016', '14.24', '4645', 'Shadowflame',          'AP',    'LOW_CC',  80, 'Anti-shield AP + bonus mpen contra escudos', 'MID'),
 ('IC-017', '14.24', '3083', 'Warmog''s Armor',       'MIXED', 'LOW_CC',  76, 'Sustain enorme vs poke (regen 5% HP/s fuera de combate)', 'MID'),
 ('IC-018', '14.24', '4401', 'Force of Nature',      'AP',    'LOW_CC',  88, 'MR escalable + movspeed - counter premium AP heavy', 'MID'),
 ('IC-019', '14.24', '4644', 'Crown of the Shattered Queen', 'AP', 'LOW_CC', 81, 'Escudo Poise vs primer hit AP - ideal mid lane vs assassins AP', 'MID'),
 ('IC-020', '14.24', '3193', 'Gargoyle Stoneplate',  'MIXED', 'HIGH_CC', 79, 'Activo +40% defensas vs comp engage - tank teamfight', 'LATE'),
 ('IC-021', '14.24', '6655', 'Luden''s Companion',    'AP',    'LOW_CC',  72, 'AP + waveclear vs poke comps', 'MID'),
 ('IC-022', '14.24', '3504', 'Ardent Censer',        'MIXED', 'LOW_CC',  70, 'Enchanter ADC enabler - counter pasivo a engage', 'MID');


-- ─── KB_THREAT_RULES (>= 10 reglas seed) ────────────────────────────────────
INSERT INTO KB_THREAT_RULES (rule_id, patch_version, context, if_enemy_champion_id, if_enemy_ability_tag, if_enemy_comp_tag, then_threat_score, then_counter_item_ids_csv, then_counter_stat_focus, explanation_template, confidence, enabled)
VALUES ('TR-001', '14.24', 'LANE', 238, NULL, NULL, 85, '3157,3047', 'ARMOR', 'Zed es un asesino AD con burst extremo - priorizar Armadura y Zhonya', 0.9, TRUE);

INSERT INTO KB_THREAT_RULES (rule_id, patch_version, context, if_enemy_champion_id, if_enemy_ability_tag, if_enemy_comp_tag, then_threat_score, then_counter_item_ids_csv, then_counter_stat_focus, explanation_template, confidence, enabled)
VALUES ('TR-002', '14.24', 'LANE', 157, NULL, NULL, 80, '3143,3047', 'ARMOR', 'Yasuo escala con golpes criticos - Randuin reduce su impacto', 0.85, TRUE);

INSERT INTO KB_THREAT_RULES (rule_id, patch_version, context, if_enemy_champion_id, if_enemy_ability_tag, if_enemy_comp_tag, then_threat_score, then_counter_item_ids_csv, then_counter_stat_focus, explanation_template, confidence, enabled)
VALUES ('TR-003', '14.24', 'LANE', 84, NULL, NULL, 82, '3111,3156', 'MAGIC_RESIST', 'Akali tiene burst AP - Resistencia Magica y Maw recomendados', 0.88, TRUE);

INSERT INTO KB_THREAT_RULES (rule_id, patch_version, context, if_enemy_champion_id, if_enemy_ability_tag, if_enemy_comp_tag, then_threat_score, then_counter_item_ids_csv, then_counter_stat_focus, explanation_template, confidence, enabled)
VALUES ('TR-004', '14.24', 'LANE', NULL, 'STUN', NULL, 65, '3111', 'TENACITY', 'CC de aturdimiento detectado - Mercury reduce la duracion', 0.75, TRUE);

INSERT INTO KB_THREAT_RULES (rule_id, patch_version, context, if_enemy_champion_id, if_enemy_ability_tag, if_enemy_comp_tag, then_threat_score, then_counter_item_ids_csv, then_counter_stat_focus, explanation_template, confidence, enabled)
VALUES ('TR-005', '14.24', 'TEAMFIGHT', NULL, 'KNOCKUP', NULL, 70, '3157,3026', 'ARMOR', 'Knockup enemigo en teamfight - Zhonya o GA para sobrevivir', 0.72, TRUE);

INSERT INTO KB_THREAT_RULES (rule_id, patch_version, context, if_enemy_champion_id, if_enemy_ability_tag, if_enemy_comp_tag, then_threat_score, then_counter_item_ids_csv, then_counter_stat_focus, explanation_template, confidence, enabled)
VALUES ('TR-006', '14.24', 'LANE', NULL, NULL, 'HEAVY_AD', 90, '3047,3110,3143', 'ARMOR', 'Composicion enemiga dominante AD - stackear Armadura es clave', 0.92, TRUE);

INSERT INTO KB_THREAT_RULES (rule_id, patch_version, context, if_enemy_champion_id, if_enemy_ability_tag, if_enemy_comp_tag, then_threat_score, then_counter_item_ids_csv, then_counter_stat_focus, explanation_template, confidence, enabled)
VALUES ('TR-007', '14.24', 'LANE', NULL, NULL, 'HEAVY_AP', 88, '3111,3156,3102', 'MAGIC_RESIST', 'Composicion enemiga dominante AP - priorizar Resistencia Magica', 0.90, TRUE);

INSERT INTO KB_THREAT_RULES (rule_id, patch_version, context, if_enemy_champion_id, if_enemy_ability_tag, if_enemy_comp_tag, then_threat_score, then_counter_item_ids_csv, then_counter_stat_focus, explanation_template, confidence, enabled)
VALUES ('TR-008', '14.24', 'LANE', 114, NULL, NULL, 78, '3110,3143', 'ARMOR', 'Fiora penetra con su pasiva (dano verdadero) - Frozen Heart reduce su AS', 0.80, TRUE);

INSERT INTO KB_THREAT_RULES (rule_id, patch_version, context, if_enemy_champion_id, if_enemy_ability_tag, if_enemy_comp_tag, then_threat_score, then_counter_item_ids_csv, then_counter_stat_focus, explanation_template, confidence, enabled)
VALUES ('TR-009', '14.24', 'LANE', NULL, 'ROOT', NULL, 60, '3111', 'TENACITY', 'Root enemigo detectado - Tenacidad ayuda a reducir la inmovilizacion', 0.70, TRUE);

INSERT INTO KB_THREAT_RULES (rule_id, patch_version, context, if_enemy_champion_id, if_enemy_ability_tag, if_enemy_comp_tag, then_threat_score, then_counter_item_ids_csv, then_counter_stat_focus, explanation_template, confidence, enabled)
VALUES ('TR-010', '14.24', 'OBJECTIVE', 11, NULL, NULL, 75, '3110,3143', 'ARMOR', 'Master Yi en objetivo - Frozen Heart y Randuin frenan su DPS sostenido', 0.82, TRUE);

INSERT INTO KB_THREAT_RULES (rule_id, patch_version, context, if_enemy_champion_id, if_enemy_ability_tag, if_enemy_comp_tag, then_threat_score, then_counter_item_ids_csv, then_counter_stat_focus, explanation_template, confidence, enabled)
VALUES ('TR-011', '14.24', 'LANE', 8, NULL, NULL, 72, '3111,3165', 'ANTI_HEAL', 'Vladimir se cura constantemente - Anti-heal es obligatorio', 0.85, TRUE);

INSERT INTO KB_THREAT_RULES (rule_id, patch_version, context, if_enemy_champion_id, if_enemy_ability_tag, if_enemy_comp_tag, then_threat_score, then_counter_item_ids_csv, then_counter_stat_focus, explanation_template, confidence, enabled)
VALUES ('TR-012', '14.24', 'LANE', 245, NULL, NULL, 76, '3111,3156', 'MAGIC_RESIST', 'Ekko tiene burst AP con rewind - MR y Maw para sobrevivir su combo', 0.83, TRUE);

INSERT INTO KB_THREAT_RULES (rule_id, patch_version, context, if_enemy_champion_id, if_enemy_ability_tag, if_enemy_comp_tag, then_threat_score, then_counter_item_ids_csv, then_counter_stat_focus, explanation_template, confidence, enabled)
VALUES ('TR-013', '14.24', 'TEAMFIGHT', NULL, 'SUPPRESS', NULL, 80, '3140', 'TENACITY', 'Suppress enemigo en teamfight - QSS es la unica counter directa', 0.88, TRUE);

INSERT INTO KB_THREAT_RULES (rule_id, patch_version, context, if_enemy_champion_id, if_enemy_ability_tag, if_enemy_comp_tag, then_threat_score, then_counter_item_ids_csv, then_counter_stat_focus, explanation_template, confidence, enabled)
VALUES ('TR-014', '14.24', 'SKIRMISH', 64, NULL, NULL, 68, '3047,6333', 'ARMOR', 'Lee Sin en escaramuza - Death''s Dance y Steelcaps mitigan su burst temprano', 0.78, TRUE);

INSERT INTO KB_THREAT_RULES (rule_id, patch_version, context, if_enemy_champion_id, if_enemy_ability_tag, if_enemy_comp_tag, then_threat_score, then_counter_item_ids_csv, then_counter_stat_focus, explanation_template, confidence, enabled)
VALUES ('TR-015', '14.24', 'LANE', NULL, 'KNOCKUP', NULL, 55, '3157', 'ARMOR', 'Knockups en lane - Zhonya permite cancelar combos', 0.70, TRUE);

-- Bloque ampliado desde novarift_lol_research (special threat patterns:
-- HIGH_SELF_HEAL, HARD_ENGAGE, SHIELD_GENERATORS, true damage, tank engage)
-- Reglas a nivel de COMPOSICIÓN — el engine ahora detecta automáticamente
-- HEAVY_HEALING/HEAVY_ENGAGE/HEAVY_SHIELDS/HYPER_CARRY/POKE_SIEGE/
-- SPLIT_PUSH/BURST_PICK/TRUE_DAMAGE_HEAVY a partir de los IDs enemigos.
INSERT INTO KB_THREAT_RULES (rule_id, patch_version, context, if_enemy_champion_id, if_enemy_ability_tag, if_enemy_comp_tag, then_threat_score, then_counter_item_ids_csv, then_counter_stat_focus, explanation_template, confidence, enabled) VALUES
 ('TR-COMP-01', '14.24', 'TEAMFIGHT', NULL, NULL, 'HEAVY_HEALING',     90, '6609,3033,3165,3075', 'ANTI_HEAL',     'Comp con healing masivo (Aatrox/Vlad/Mundo/Soraka) - anti-heal en primer back, sin discusion', 0.93, TRUE),
 ('TR-COMP-02', '14.24', 'TEAMFIGHT', NULL, NULL, 'HEAVY_ENGAGE',      88, '3157,3026,3193,3140', 'SURVIVAL',     'Comp con multi-engage (Malphite/Amumu/Leona) - Zhonya/GA/Stoneplate o QSS para sobrevivir el combo', 0.91, TRUE),
 ('TR-COMP-03', '14.24', 'TEAMFIGHT', NULL, NULL, 'HEAVY_SHIELDS',     82, '6695,4645', 'ANTI_SHIELD',          'Comp con muchos shields (Janna/Lulu/Karma/Sona/Seraphine) - Serpent Fang (AD) o Shadowflame (AP) rompe el muro', 0.88, TRUE),
 ('TR-COMP-04', '14.24', 'TEAMFIGHT', NULL, NULL, 'HYPER_CARRY',       86, '3140,3157,6695,3814', 'BURST_KILL',  'Hyper carry enemigo (Jinx/Kog/Vayne/Aphelios) - matar al carry antes de 6 items con kit assassin/QSS/Zhonya', 0.85, TRUE),
 ('TR-COMP-05', '14.24', 'OBJECTIVE', NULL, NULL, 'POKE_SIEGE',        80, '3083,3009,3107,3190', 'SUSTAIN',     'Comp poke a torre (Jayce/Ezreal/Xerath) - Warmog para sustain, Boots Swiftness contra slows, Locket en TF', 0.83, TRUE),
 ('TR-COMP-06', '14.24', 'OBJECTIVE', NULL, NULL, 'SPLIT_PUSH',        78, '3742,3083,6675', 'WAVECLEAR',         'Split push enemigo (Fiora/Tryn/Jax/Camille) - Dead Mans para rotar, Warmog para 1v1, sostener Teleport activo', 0.81, TRUE),
 ('TR-COMP-07', '14.24', 'TEAMFIGHT', NULL, NULL, 'BURST_PICK',        85, '3026,3157,3140,4644', 'SURVIVAL',    'Comp con multi-assassin (Zed/Talon/Akali/LeBlanc) - GA/Zhonya/QSS/Crown of the Shattered Queen son no-negociables', 0.89, TRUE),
 ('TR-COMP-08', '14.24', 'TEAMFIGHT', NULL, NULL, 'TRUE_DAMAGE_HEAVY', 75, '3193,3026,4401', 'TANK_BUFFER',      'True damage heavy (Vayne/Fiora/Camille/Garen) - apilar HP no sirve - GA + Stoneplate + Force of Nature mitigan', 0.78, TRUE);

-- Reglas adicionales por campeon especifico (continuacion ampliada)
INSERT INTO KB_THREAT_RULES (rule_id, patch_version, context, if_enemy_champion_id, if_enemy_ability_tag, if_enemy_comp_tag, then_threat_score, then_counter_item_ids_csv, then_counter_stat_focus, explanation_template, confidence, enabled) VALUES
 ('TR-016', '14.24', 'LANE',     266,  NULL,   NULL,            85, '6609,3033', 'ANTI_HEAL',   'Aatrox tiene heal masivo con su Q3 - rush Chempunk Chainsword o Mortal Reminder', 0.90, TRUE),
 ('TR-017', '14.24', 'LANE',     122,  NULL,   NULL,            82, '6609,3047', 'ANTI_HEAL',   'Darius escala con heals de R - anti-heal AD obligatorio + Steelcaps', 0.88, TRUE),
 ('TR-018', '14.24', 'LANE',     17,   NULL,   NULL,            70, '3009,3083', 'SUSTAIN',     'Teemo poke con shrooms y blind - Boots of Swiftness y Warmog para sustain', 0.75, TRUE),
 ('TR-019', '14.24', 'TEAMFIGHT',54,   NULL,   NULL,            85, '3157,3193', 'ARMOR',       'Malphite engage AP con R unstoppable - Zhonya/Stoneplate sobreviven el follow-up', 0.87, TRUE),
 ('TR-020', '14.24', 'TEAMFIGHT',32,   NULL,   NULL,            82, '3111,3157', 'TENACITY',    'Amumu R = 1.5s stun AOE - Mercurys + Zhonya neutralizan engage', 0.88, TRUE),
 ('TR-021', '14.24', 'TEAMFIGHT',89,   NULL,   NULL,            80, '3111,3157,3140', 'TENACITY','Leona stack de CC - Mercurys, QSS o Zhonya para no morir en su combo', 0.86, TRUE),
 ('TR-022', '14.24', 'LANE',     67,   NULL,   NULL,            78, '3047,3026,3193', 'ARMOR',  'Vayne true damage con W vs HP stacks - Steelcaps + GA + Stoneplate', 0.84, TRUE),
 ('TR-023', '14.24', 'LANE',     114,  NULL,   NULL,            80, '3047,3026,3193', 'ARMOR',  'Fiora true damage con vitals + R heal - Steelcaps + GA + Stoneplate clutch', 0.85, TRUE),
 ('TR-024', '14.24', 'TEAMFIGHT',NULL, NULL,   'HEAVY_HEALING', 90, '6609,3033,3165', 'ANTI_HEAL', 'Composicion enemiga con sustain masivo - rush anti-heal en cuanto haya 800g', 0.92, TRUE),
 ('TR-025', '14.24', 'TEAMFIGHT',NULL, NULL,   'HEAVY_SHIELDS', 85, '6695,4645', 'ANTI_SHIELD', 'Comp con muchos shields (Janna/Lulu/Karma) - Serpent Fang o Shadowflame rompen escudos', 0.86, TRUE),
 ('TR-026', '14.24', 'OBJECTIVE',NULL, NULL,   'POKE_SIEGE',    78, '3083,3009', 'SUSTAIN',     'Comp poke a torre - Warmog y Boots Swiftness para llegar a engage', 0.80, TRUE),
 ('TR-027', '14.24', 'TEAMFIGHT',NULL, NULL,   'HYPER_CARRY',   88, '3140,3157,6695', 'BURST',  'Hyper carry enemigo (Jinx/Kog/Vayne) - kit assassin con QSS/Zhonya/Serpent Fang antes 6 items', 0.85, TRUE),
 ('TR-028', '14.24', 'LANE',     8,    NULL,   NULL,            82, '6609,3165', 'ANTI_HEAL',   'Vladimir self-sustain por Q - anti-heal AP (Morello) o AD (Chempunk) en primer back', 0.90, TRUE),
 ('TR-029', '14.24', 'LANE',     19,   NULL,   NULL,            76, '6609,3033', 'ANTI_HEAL',   'Warwick R ejecuta + heal pasivo - anti-heal frena su 1v1', 0.83, TRUE);
