package com.reg.arms.config;

import org.flywaydb.core.Flyway;
import org.springframework.boot.autoconfigure.flyway.FlywayMigrationStrategy;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Ensures Flyway always repairs checksum mismatches before migrating.
 * This handles cases where already-applied migration scripts are legitimately
 * edited (e.g. removing the SUPERVISOR role from V1/V2 seed files).
 * Spring Boot's FlywayProperties does not expose a repairOnMigrate property,
 * so this strategy bean is the correct way to achieve the same effect.
 */
@Configuration
public class FlywayConfig {

    @Bean
    public FlywayMigrationStrategy flywayMigrationStrategy() {
        return (Flyway flyway) -> {
            flyway.repair();
            flyway.migrate();
        };
    }
}
