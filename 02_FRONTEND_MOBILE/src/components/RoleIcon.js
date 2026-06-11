// ============================================================================
// RoleIcon — Wrapper canónico que renderiza el icono SVG de un rol.
// ----------------------------------------------------------------------------
// Sustituye cualquier emoji o texto plano de rol.
//
// Props:
// role (string) — 'TOP' | 'JUNGLE' | 'MID' | 'ADC' | 'SUPPORT'
// size (number) — diámetro en px (default 32)
// color (string) — color de stroke (default #fff)
//
// Uso:
// <RoleIcon role="MID" size={28} color={FACTIONS[user.faction].primary} />
//
// Si el rol no existe en ROLE_ICONS, devuelve null (no crashea).
// ============================================================================
import React from 'react';
import { ROLE_ICONS } from '../data/roleAssets';

export default function RoleIcon({ role, size = 32, color = '#ffffff' }) {
  const Icon = ROLE_ICONS[role];
  if (!Icon) return null;
  return <Icon size={size} color={color} />;
}
