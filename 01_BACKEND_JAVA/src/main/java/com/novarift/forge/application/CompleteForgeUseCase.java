package com.novarift.forge.application;

import java.util.Map;

public interface CompleteForgeUseCase {
    Map<String, Object> execute(String riotId, Map<String, Object> metrics);
}
