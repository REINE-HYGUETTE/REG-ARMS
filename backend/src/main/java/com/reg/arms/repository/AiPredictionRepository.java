package com.reg.arms.repository;

import com.reg.arms.entity.AiPrediction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface AiPredictionRepository extends JpaRepository<AiPrediction, Long> {

    /** Most recent prediction for a given request (there should only ever be one). */
    Optional<AiPrediction> findTopByRequestIdOrderByCreatedAtDesc(Long requestId);

    /**
     * Accuracy breakdown used by the AI Predictions dashboard.
     * Only rows where staff has confirmed the actual priority are counted.
     */
    @Query("SELECT p.predictedPriority, COUNT(p), " +
           "SUM(CASE WHEN p.isCorrect = true THEN 1 ELSE 0 END), " +
           "AVG(p.confidenceScore) " +
           "FROM AiPrediction p WHERE p.actualPriority IS NOT NULL " +
           "GROUP BY p.predictedPriority")
    List<Object[]> accuracyByPriority();

    /**
     * Real confusion matrix: rows = predicted priority, cols = actual priority.
     * Returns rows of [predictedPriority, actualPriority, count].
     */
    @Query("SELECT p.predictedPriority, p.actualPriority, COUNT(p) " +
           "FROM AiPrediction p " +
           "WHERE p.actualPriority IS NOT NULL " +
           "GROUP BY p.predictedPriority, p.actualPriority " +
           "ORDER BY p.predictedPriority, p.actualPriority")
    List<Object[]> confusionMatrix();

    /**
     * Confidence score distribution bucketed into 10-percentage-point bands.
     * Returns [bucketLabel, count] e.g. ["50-60%", 42].
     */
    @Query(value = "SELECT " +
                   "  CASE " +
                   "    WHEN confidence_score < 0.5  THEN '<50%' " +
                   "    WHEN confidence_score < 0.6  THEN '50-60%' " +
                   "    WHEN confidence_score < 0.7  THEN '60-70%' " +
                   "    WHEN confidence_score < 0.8  THEN '70-80%' " +
                   "    WHEN confidence_score < 0.9  THEN '80-90%' " +
                   "    WHEN confidence_score < 0.95 THEN '90-95%' " +
                   "    ELSE '95-100%' " +
                   "  END AS bucket, " +
                   "  COUNT(*) AS cnt " +
                   "FROM ai_predictions " +
                   "GROUP BY bucket " +
                   "ORDER BY MIN(confidence_score)",
           nativeQuery = true)
    List<Object[]> confidenceDistribution();

    /** Total predictions made in a given period. */
    @Query("SELECT COUNT(p) FROM AiPrediction p WHERE p.createdAt >= :since")
    long countSince(@Param("since") java.time.LocalDateTime since);

    /**
     * Finds predictions that are candidates for implicit-correct marking:
     * <ol>
     *   <li>No verdict yet ({@code isCorrect IS NULL}, {@code actualPriority IS NULL})</li>
     *   <li>Older than {@code cutoff} (default 48 h)</li>
     *   <li>No manual priority override by staff</li>
     *   <li>Request has progressed past Pending — gates the implicit credit on an actual
     *       staff interaction.  Requests still at Pending may never have been reviewed,
     *       so granting implicit credit would inflate accuracy statistics (S-8 fix).</li>
     *   <li>Not Cancelled — AI priority is irrelevant once a request is cancelled.</li>
     * </ol>
     */
    @Query("SELECT p FROM AiPrediction p " +
           "JOIN FETCH p.request r " +
           "WHERE p.isCorrect IS NULL " +
           "  AND p.actualPriority IS NULL " +
           "  AND p.createdAt < :cutoff " +
           "  AND r.manualPriority IS NULL " +
           "  AND r.status NOT IN " +
           "      (com.reg.arms.entity.enums.RequestStatus.Pending, " +
           "       com.reg.arms.entity.enums.RequestStatus.Cancelled)")
    List<AiPrediction> findImplicitCorrectCandidates(
            @Param("cutoff") java.time.LocalDateTime cutoff);
}
