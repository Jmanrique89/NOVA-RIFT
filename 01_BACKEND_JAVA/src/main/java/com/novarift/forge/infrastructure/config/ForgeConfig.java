package com.novarift.forge.infrastructure.config;

import com.novarift.forge.application.AnalyzeProgressionUseCase;
import com.novarift.forge.application.AnalyzeProgressionUseCaseImpl;
import com.novarift.forge.application.CompleteForgeUseCase;
import com.novarift.forge.application.CompleteForgeUseCaseImpl;
import com.novarift.forge.domain.UserProgressRepository;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class ForgeConfig {

    @Bean
    public AnalyzeProgressionUseCase analyzeProgressionUseCase(UserProgressRepository repository) {
        return new AnalyzeProgressionUseCaseImpl(repository);
    }

    @Bean
    public CompleteForgeUseCase completeForgeUseCase(UserProgressRepository repository) {
        return new CompleteForgeUseCaseImpl(repository);
    }
}
