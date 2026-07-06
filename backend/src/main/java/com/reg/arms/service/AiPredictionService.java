package com.reg.arms.service;

import com.reg.arms.entity.AiPrediction;
import com.reg.arms.entity.Request;
import com.reg.arms.entity.enums.PriorityLevel;
import com.reg.arms.repository.AiPredictionRepository;
import com.reg.arms.repository.RequestRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import org.springframework.data.domain.PageRequest;

import java.math.BigDecimal;
import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AiPredictionService {

    private final AiPredictionRepository aiPredictionRepository;
    private final RequestRepository requestRepository;

    // Generous read timeout so a free-tier AI service that has spun down has
    // time to cold-start and answer (Render holds the request during wake-up),
    // instead of instantly failing to the category-default fallback.
    private final RestClient aiClient = RestClient.builder()
            .requestFactory(timeoutFactory())
            .build();

    private static SimpleClientHttpRequestFactory timeoutFactory() {
        SimpleClientHttpRequestFactory f = new SimpleClientHttpRequestFactory();
        f.setConnectTimeout(Duration.ofSeconds(10));
        f.setReadTimeout(Duration.ofSeconds(60));
        return f;
    }

    @Value("${app.ai.api-url}")
    private String aiApiUrl;

    /**
     * Call the Flask AI service and return a prediction.
     * <p>
     * The Flask endpoint now returns a flat JSON object — no {success, data, ...}
     * wrapper — so every field is read directly from the top-level map.
     * <p>
     * On any failure (service down, parse error, etc.) we fall back to the
     * category's {@code defaultPriority} set by the admin, rather than a
     * hardcoded Medium.  This makes the admin-configured category priority
     * the true safety net when AI is unavailable.
     */
    public AiResult predict(String title, String description, String categoryName,
                            PriorityLevel categoryDefault) {
        try {
            Map<String, Object> response = callAiWithRetry(title, description, categoryName);

            if (response == null) {
                log.warn("AI service returned null response — falling back to category default ({})",
                        categoryDefault);
                return AiResult.fallback(categoryDefault);
            }

            // The Flask API returns these fields at the top level (flat response).
            String  priority   = (String)  response.getOrDefault("priority",   "Medium");
            Number  confidence = (Number)  response.getOrDefault("confidence", 0.0);
            Boolean isUncertain = (Boolean) response.getOrDefault("is_uncertain", false);
            Number  processingMs = (Number) response.getOrDefault("processing_ms", 0);

            @SuppressWarnings("unchecked")
            List<String> keywords = (List<String>) response.get("keywords_detected");

            @SuppressWarnings("unchecked")
            List<String> topFeatures = (List<String>) response.get("top_features");

            @SuppressWarnings("unchecked")
            Map<String, Object> modelScores = (Map<String, Object>) response.get("model_scores");

            @SuppressWarnings("unchecked")
            Map<String, Object> allProbabilities = (Map<String, Object>) response.get("all_probabilities");

            PriorityLevel level = parsePriority(priority);

            log.info("AI prediction: priority={} confidence={}% uncertain={} keywords={} processingMs={}",
                    level,
                    Math.round(confidence.doubleValue() * 100),
                    isUncertain,
                    keywords != null && !keywords.isEmpty() ? keywords : "none",
                    processingMs.intValue());

            return new AiResult(
                    level,
                    BigDecimal.valueOf(confidence.doubleValue()),
                    keywords,
                    modelScores,
                    allProbabilities,
                    topFeatures,
                    Boolean.TRUE.equals(isUncertain),
                    processingMs.intValue());

        } catch (Exception e) {
            log.warn("AI prediction failed — falling back to category default ({}). Reason: {}",
                    categoryDefault, e.getMessage());
            return AiResult.fallback(categoryDefault);
        }
    }

    /**
     * POST to the AI service, retrying once. The first request after the service
     * has been idle may fail fast while it spins up; a short pause and one retry
     * lets the now-waking service answer before we give up to the fallback.
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> callAiWithRetry(String title, String description, String categoryName) {
        RuntimeException last = null;
        for (int attempt = 1; attempt <= 2; attempt++) {
            try {
                return aiClient.post()
                        .uri(aiApiUrl + "/api/predict")
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(Map.of(
                                "title",       title,
                                "description", description,
                                "category",    categoryName))
                        .retrieve()
                        .body(Map.class);
            } catch (RuntimeException e) {
                last = e;
                log.warn("AI call attempt {}/2 failed: {}", attempt, e.getMessage());
                if (attempt < 2) {
                    try {
                        Thread.sleep(1500);
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        break;
                    }
                }
            }
        }
        throw last != null ? last : new IllegalStateException("AI call failed");
    }

    /**
     * Persist the prediction row for this request.
     * actualPriority and isCorrect are left null here; they are filled in by
     * RequestService.setManualPriority() once staff confirms the correct priority.
     */
    public void savePrediction(Request request, AiResult result) {
        // Build keywords + top features JSON for storage
        Map<String, Object> keywordsJson = new HashMap<>();
        if (result.keywords() != null && !result.keywords().isEmpty()) {
            keywordsJson.put("keywords", result.keywords());
        }
        if (result.topFeatures() != null && !result.topFeatures().isEmpty()) {
            keywordsJson.put("top_features", result.topFeatures());
        }

        AiPrediction prediction = AiPrediction.builder()
                .request(request)
                .modelVersion("ensemble-v1.2")
                .inputText(request.getDescription())
                .predictedPriority(result.priority())
                .confidenceScore(result.confidence())
                .processingMs(result.processingMs())
                .keywordsDetected(keywordsJson.isEmpty() ? null : keywordsJson)
                .tfidfFeatures(result.allProbabilities() != null ? result.allProbabilities() : null)
                .build();

        if (result.modelScores() != null) {
            Number logistic = (Number) result.modelScores().get("logistic_regression");
            Number rf       = (Number) result.modelScores().get("random_forest");
            Number nb       = (Number) result.modelScores().get("naive_bayes");
            if (logistic != null) prediction.setLogisticScore(BigDecimal.valueOf(logistic.doubleValue()));
            if (rf       != null) prediction.setRandomForestScore(BigDecimal.valueOf(rf.doubleValue()));
            if (nb       != null) prediction.setNaiveBayesScore(BigDecimal.valueOf(nb.doubleValue()));
        }

        aiPredictionRepository.save(prediction);
    }

    // ------------------------------------------------------------------
    // Retraining
    // ------------------------------------------------------------------

    /**
     * Pull resolved/closed requests as ground-truth training samples,
     * then POST them to the Flask /api/model/retrain endpoint.
     *
     * @return a message from the Flask service describing the outcome.
     */
    /** Hard cap on training samples sent in a single retrain call. */
    private static final int MAX_RETRAIN_SAMPLES = 5_000;

    public String retrain() {
        // Only use requests where a staff member explicitly set the manual priority
        // (i.e. confirmed the correct label). Using AI's own predictions as training
        // data would reinforce its biases rather than correct them.
        // Uses a pageable query to avoid loading all rows into memory.
        List<Request> confirmed = requestRepository
                .findStaffConfirmedForRetrain(PageRequest.of(0, MAX_RETRAIN_SAMPLES))
                .getContent();

        List<Map<String, String>> trainingData = confirmed.stream()
                .map(r -> {
                    Map<String, String> sample = new HashMap<>();
                    sample.put("text",  (r.getTitle() + ". " + r.getDescription()).strip());
                    sample.put("label", r.getManualPriority().name());  // ground truth only
                    return sample;
                })
                .collect(Collectors.toList());

        log.info("Sending {} staff-confirmed requests as training data to Flask for retraining " +
                 "(only manual overrides used to avoid reinforcing AI bias)", trainingData.size());

        try {
            RestClient client = RestClient.create();

            @SuppressWarnings("unchecked")
            Map<String, Object> response = client.post()
                    .uri(aiApiUrl + "/api/model/retrain")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("training_data", trainingData))
                    .retrieve()
                    .body(Map.class);

            String message = response != null
                    ? (String) response.getOrDefault("message", "Retrain triggered")
                    : "Retrain triggered (no message)";

            log.info("AI retrain response: {}", message);
            return message;

        } catch (Exception e) {
            log.error("AI retrain failed: {}", e.getMessage());
            throw new RuntimeException("AI service retrain failed: " + e.getMessage(), e);
        }
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    private PriorityLevel parsePriority(String value) {
        try {
            return PriorityLevel.valueOf(value);
        } catch (IllegalArgumentException e) {
            log.warn("Unknown priority '{}' returned by AI — defaulting to Medium", value);
            return PriorityLevel.Medium;
        }
    }

    // ------------------------------------------------------------------
    // Result record
    // ------------------------------------------------------------------

    public record AiResult(
            PriorityLevel       priority,
            BigDecimal          confidence,
            List<String>        keywords,
            Map<String, Object> modelScores,
            Map<String, Object> allProbabilities,
            List<String>        topFeatures,
            boolean             isUncertain,
            int                 processingMs
    ) {
        /**
         * Used when the AI service is unavailable or returns an error.
         * Uses the category's admin-configured default priority as the fallback
         * instead of a hardcoded Medium, so the admin's intent is always respected.
         */
        public static AiResult fallback(PriorityLevel categoryDefault) {
            PriorityLevel safe = categoryDefault != null ? categoryDefault : PriorityLevel.Medium;
            return new AiResult(safe, BigDecimal.ZERO,
                    List.of(), null, null, List.of(), true, 0);
        }

        /** Convenience overload — used in tests or where no category context is available. */
        public static AiResult fallback() {
            return fallback(PriorityLevel.Medium);
        }

        public boolean isFallback() {
            return BigDecimal.ZERO.compareTo(confidence) == 0;
        }
    }
}
