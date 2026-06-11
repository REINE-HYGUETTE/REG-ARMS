package com.reg.arms.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.lang.NonNull;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    @Override
    public void addInterceptors(@NonNull InterceptorRegistry registry) {
        // Login: max 10 attempts per IP per 60 seconds (brute-force protection)
        registry.addInterceptor(new RateLimitInterceptor(10, 60_000))
                .addPathPatterns("/api/auth/login");

        // AI predict: max 30 requests per IP per 60 seconds (cost / abuse protection)
        registry.addInterceptor(new RateLimitInterceptor(30, 60_000))
                .addPathPatterns("/api/requests/predict");
    }
}
