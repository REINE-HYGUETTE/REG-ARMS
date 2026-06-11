package com.reg.arms.entity;

import com.reg.arms.entity.enums.PriorityLevel;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Map;

@Entity
@Table(name = "ai_predictions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AiPrediction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "request_id", nullable = false)
    private Request request;

    @Column(name = "model_version", nullable = false, length = 50)
    private String modelVersion;

    @Column(name = "input_text", columnDefinition = "TEXT")
    private String inputText;

    @Enumerated(EnumType.STRING)
    @Column(name = "predicted_priority", nullable = false, columnDefinition = "priority_level")
    private PriorityLevel predictedPriority;

    @Column(name = "confidence_score", nullable = false, precision = 5, scale = 4)
    private BigDecimal confidenceScore;

    @Column(name = "logistic_score", precision = 5, scale = 4)
    private BigDecimal logisticScore;

    @Column(name = "random_forest_score", precision = 5, scale = 4)
    private BigDecimal randomForestScore;

    @Column(name = "naive_bayes_score", precision = 5, scale = 4)
    private BigDecimal naiveBayesScore;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "tfidf_features", columnDefinition = "jsonb")
    private Map<String, Object> tfidfFeatures;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "keywords_detected", columnDefinition = "jsonb")
    private Map<String, Object> keywordsDetected;

    @Enumerated(EnumType.STRING)
    @Column(name = "actual_priority", columnDefinition = "priority_level")
    private PriorityLevel actualPriority;

    @Column(name = "is_correct")
    private Boolean isCorrect;

    @Column(name = "processing_ms")
    private Integer processingMs;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
