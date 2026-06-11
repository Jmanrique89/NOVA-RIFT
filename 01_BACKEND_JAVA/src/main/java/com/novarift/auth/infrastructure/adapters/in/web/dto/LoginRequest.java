package com.novarift.auth.infrastructure.adapters.in.web.dto;

/** Body de POST /api/v1/auth/login. */
public record LoginRequest(String username, String password) {}
