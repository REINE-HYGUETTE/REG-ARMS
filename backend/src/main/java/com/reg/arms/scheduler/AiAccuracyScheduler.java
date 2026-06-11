package com.reg.arms.scheduler;

import com.reg.arms.entity.AiPrediction;
import com.reg.arms.repository.AiPredictionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Periodically marks AI predictions as "implicitly correct" when:
 *  - The prediction was made more than 48 hours ago
 *  - No staff override (manual priority) has been applied
 *  - isCorrect has not been set yet
 *
 * Rationale: if staff reviewed the request and DID NOT override the AI,
 * the AI was most likely correct. This avoids the accuracy metric being
 * biased to only count disagreements as feedback.
 *
 * Runs every 6 hours. Only processes predictions that lack a final verdict.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class AiAccuracyScheduler {

    private final AiPredictionRepository aiPredictionRepository;

    @Scheduled(fixedDelay = 6 * 60 * 60 * 1_000)   // every 6 hours
    @Transactional
    public void confirmImplicitAccuracy() {
        LocalDateTime cutoff = LocalDateTime.now().minusHours(48);

        // Use a targeted DB query instead of findAll() to avoid loading all predictions into memory
        List<AiPrediction> unconfirmed = aiPredictionRepository.findImplicitCorrectCandidates(cutoff);

        if (unconfirmed.isEmpty()) return;

        log.info("AI accuracy scheduler: marking {} predictions as implicitly correct (no override after 48h)",
                unconfirmed.size());

        for (AiPrediction prediction : unconfirmed) {
            try {
                // No override means staff accepted the AI prediction → treat as correct
                prediction.setActualPriority(prediction.getPredictedPriority());
                prediction.setIsCorrect(true);
                aiPredictionRepository.save(prediction);
            } catch (Exception e) {
                log.warn("Could not confirm prediction {}: {}", prediction.getId(), e.getMessage());
            }
        }

        log.info("AI accuracy scheduler: done — {} predictions confirmed", unconfirmed.size());
    }
}
