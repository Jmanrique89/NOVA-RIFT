// ============================================================================
// RadarContext — control global del FloatingRadarWidget + sesión de partida
// ----------------------------------------------------------------------------
// El widget vive a nivel del navigator (App.js → AppTabs wrapper) para que
// persista entre tabs. Cualquier pantalla puede abrirlo/cerrarlo con:
//
// import { useRadar } from '../context/RadarContext';
// const { open, close, toggle, openWithSession } = useRadar();
//
// Estado:
// visible — controla si el widget se renderiza.
// minimized — si true, el widget muestra el pill colapsado.
// gameSession — null | objeto con shape de MOCK_GAME_SESSION; cuando está
// presente, el widget pasa a "modo partida" (datos en vivo en
// lugar del formulario de escaneo).
//
// El estado vive aquí (y no dentro del componente) precisamente para que el
// widget persista minimizado entre tabs: al cambiar de pantalla se sigue viendo
// el pill "◉ RADAR ACTIVO" / "◉ Jinx · EN CURSO" abajo a la derecha.
// ============================================================================
import React, { createContext, useCallback, useContext, useState } from 'react';

const RadarContext = createContext({
  visible:           false,
  minimized:         false,
  gameSession:       null,
  selectedChampion:  null,
  // Modo presentación: auto-rota escenarios cada 8 s en InGameHUD. Lo activa el
  // botón "MODO PRESENTACIÓN" del Profile (útil para grabar la demo).
  presentationMode:  false,
  open:              () => {},
  close:             () => {},
  minimize:          () => {},
  expand:            () => {},
  toggle:            () => {},
  openWithSession:   () => {},
  setGameSession:    () => {},
  setSelectedChampion: () => {},
});

export function RadarProvider({ children }) {
  const [visible,          setVisible]          = useState(false);
  const [minimized,        setMinimized]        = useState(false);
  const [gameSession,      setGameSession]      = useState(null);
  // Campeón confirmado en Champion Select. Se guarda aquí para que el resto de
  // la app (LiveScreen, InGameHUD, FloatingRadarWidget) lo lea sin pasarlo por
  // props. Se limpia al cerrar el widget.
  const [selectedChampion, setSelectedChampion] = useState(null);
  // Flag del modo presentación. Persiste hasta que el usuario sale del HUD; se
  // resetea junto con gameSession en `close()`.
  const [presentationMode, setPresentationMode] = useState(false);

  const open = useCallback(() => {
    setVisible(true);
    setMinimized(false);
  }, []);

  // Cerrar limpia gameSession, selectedChampion y presentationMode — la
  // próxima apertura empieza limpia (champ select, scan, partida — todo desde cero).
  const close = useCallback(() => {
    setVisible(false);
    setMinimized(false);
    setGameSession(null);
    setSelectedChampion(null);
    setPresentationMode(false);
  }, []);

  const minimize = useCallback(() => setMinimized(true),  []);
  const expand   = useCallback(() => setMinimized(false), []);
  const toggle   = useCallback(() => {
    if (!visible) { setVisible(true); setMinimized(false); return; }
    setMinimized(m => !m);
  }, [visible]);

  // Apertura directa con una sesión de partida (botón "SIMULAR PARTIDA"). La
  // segunda firma `(session, { presentationMode })` activa el rotador automático
  // del HUD; sigue siendo compatible con las llamadas que solo pasan la sesión.
  const openWithSession = useCallback((session, opts = {}) => {
    setGameSession(session || null);
    setPresentationMode(Boolean(opts.presentationMode));
    setVisible(true);
    setMinimized(false);
  }, []);

  return (
    <RadarContext.Provider
      value={{
        visible, minimized, gameSession, selectedChampion, presentationMode,
        open, close, minimize, expand, toggle,
        openWithSession, setGameSession, setSelectedChampion,
      }}
    >
      {children}
    </RadarContext.Provider>
  );
}

export const useRadar = () => useContext(RadarContext);
export default RadarContext;
