package com.reg.arms.controller;

import com.reg.arms.dto.response.ApiResponse;
import com.reg.arms.service.AiPredictionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AiController {

    private final AiPredictionService aiPredictionService;

    /**
     * POST /api/ai/retrain
     * Admin-only endpoint that collects resolved requests as ground-truth
     * training samples and sends them to the Flask service for retraining.
     */
    @PostMapping("/retrain")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse> retrain() {
        String message = aiPredictionService.retrain();
        return ResponseEntity.ok(ApiResponse.success(message));
    }
}
