package com.novarift.live.domain.recommendation;

/**
 * Ítem puntuado por el motor de scoring con desglose de factores.
 * Cada subscore está entre 0 y 100.
 */
public record ScoredItem(
    String itemId,
    String itemName,
    double scoreTotal,
    double threatMitigation,     // 0-100: cuánto mitiga la amenaza detectada
    double matchupValue,         // 0-100: valor específico contra el matchup
    double timingFit,            // 0-100: adecuación al timing de la partida
    double synergyScore,         // 0-100: sinergia con el campeón propio
    double reliability,          // 0-100: fiabilidad estadística del dato
    double opportunityCost,      // 0-100: coste de oportunidad (se resta)
    String explanation,          // explicación en lenguaje natural
    double confidence            // 0.0-1.0: confianza global de la recomendación
) implements Comparable<ScoredItem> {

    @Override
    public int compareTo(ScoredItem other) {
        int cmp = Double.compare(other.scoreTotal, this.scoreTotal);
        if (cmp == 0) {
            return Double.compare(other.reliability, this.reliability);
        }
        return cmp;
    }
}
