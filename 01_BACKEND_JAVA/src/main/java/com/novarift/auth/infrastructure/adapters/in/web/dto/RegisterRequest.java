package com.novarift.auth.infrastructure.adapters.in.web.dto;

/** Body de POST /api/v1/auth/register. */
public record RegisterRequest(String username, String email, String password) {}
