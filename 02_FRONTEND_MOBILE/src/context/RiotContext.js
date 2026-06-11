// ============================================================================
// RiotContext — identidad Riot del jugador + tema de color de la app
// ----------------------------------------------------------------------------
// Estado global compartido por toda la app vía Context (se lee con
// useContext(RiotContext)). Guarda:
// riotId / playerData / isAuthenticated → datos de la cuenta de Riot tras
// vincularla (login) y limpiados en logout.
// faction → facción NOVA RIFT elegida (null hasta pasar por FactionScreen).
// theme → tema de color. De momento siempre NEUTRAL_THEME; está aquí para
// que las pantallas tomen el color de acento (theme.primary) de un único
// sitio y migrar a temas por facción sea un cambio local.
//
// Es uno de los contextos que consumen casi todos los componentes (InGameHUD,
// ChampSelectHelper, etc.) para obtener `theme`.
// ============================================================================
import React, { createContext, useState } from 'react';
import { NEUTRAL_THEME } from '../theme/theme';

export const RiotContext = createContext();

export const RiotProvider = ({ children }) => {
  const [riotId, setRiotId] = useState('');
  const [playerData, setPlayerData] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  // null = sin facción elegida — la UI usa NEUTRAL_THEME hasta que el
  // usuario pasa por FactionScreen.
  const [faction, setFaction] = useState(null);

  const theme = NEUTRAL_THEME;

  const login = (data) => {
    setRiotId(`${data.gameName}#${data.tagLine}`);
    setPlayerData(data);
    setIsAuthenticated(true);
  };

  const logout = () => {
    setRiotId('');
    setPlayerData(null);
    setIsAuthenticated(false);
  };

  return (
    <RiotContext.Provider
      value={{
        riotId,
        setRiotId,
        playerData,
        isAuthenticated,
        login,
        logout,
        faction,
        setFaction,
        theme,
      }}
    >
      {children}
    </RiotContext.Provider>
  );
};
