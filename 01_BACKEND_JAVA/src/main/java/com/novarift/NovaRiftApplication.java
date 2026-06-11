package com.novarift;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cache.annotation.EnableCaching;

@SpringBootApplication
@EnableCaching // pasa de 30+ queries kb_champions por radar a 1 por sesión JVM
public class NovaRiftApplication {
    public static void main(String[] args) {
        SpringApplication.run(NovaRiftApplication.class, args);
    }
}
