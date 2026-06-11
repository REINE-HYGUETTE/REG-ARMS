package com.reg.arms.service;

import com.reg.arms.dto.response.CategorySuggestionResponse;
import com.reg.arms.dto.response.CategorySuggestionResponse.Suggestion;
import com.reg.arms.entity.Category;
import com.reg.arms.repository.CategoryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;
import java.util.Map;

/**
 * Suggests the most relevant categories for a request based on keyword
 * overlap between the submitted text and category names + descriptions.
 *
 * This runs entirely in Java — no external AI service call required.
 * It acts as a fast, always-available fallback even when Flask is down.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CategorySuggestionService {

    private final CategoryRepository categoryRepository;

    /** Common stop-words to ignore during tokenisation */
    private static final Set<String> STOP_WORDS = Set.of(
            "the", "a", "an", "is", "it", "in", "on", "at", "to", "for", "of", "and",
            "or", "but", "with", "my", "our", "i", "we", "has", "have", "been", "are",
            "was", "were", "not", "no", "se", "le", "la", "les", "de", "du", "je", "mon",
            "iki", "mu", "na", "muri", "kuri", "aba", "abana", "iyi", "uyu"
    );

    /**
     * Synonym map: user term → canonical category keyword(s).
     * Lets "power cut" match "Power Outage", "no lights" match "Street Lighting", etc.
     */
    private static final Map<String, List<String>> SYNONYMS = Map.ofEntries(
        Map.entry("power cut",         List.of("power", "outage")),
        Map.entry("no electricity",    List.of("power", "outage")),
        Map.entry("no power",          List.of("power", "outage")),
        Map.entry("blackout",          List.of("power", "outage")),
        Map.entry("lights out",        List.of("power", "outage")),
        Map.entry("no lights",         List.of("street", "lighting")),
        Map.entry("street lamp",       List.of("street", "lighting")),
        Map.entry("pole light",        List.of("street", "lighting")),
        Map.entry("meter problem",     List.of("meter", "issues")),
        Map.entry("wrong bill",        List.of("billing", "dispute")),
        Map.entry("overcharged",       List.of("billing", "dispute")),
        Map.entry("new connection",    List.of("connection")),
        Map.entry("apply connection",  List.of("new", "connection")),
        Map.entry("voltage issue",     List.of("voltage", "issues")),
        Map.entry("voltage problem",   List.of("voltage", "issues")),
        Map.entry("transformer",       List.of("equipment", "failure")),
        Map.entry("sparking",          List.of("safety", "hazard")),
        Map.entry("electrocution",     List.of("safety", "hazard")),
        Map.entry("wire fallen",       List.of("safety", "hazard")),
        Map.entry("electric shock",    List.of("safety", "hazard")),
        Map.entry("panne",             List.of("power", "outage")),
        Map.entry("umuriro",           List.of("power", "outage")),   // Kinyarwanda
        Map.entry("amashanyarazi",     List.of("power", "outage"))    // Kinyarwanda
    );

    @Transactional(readOnly = true)
    public CategorySuggestionResponse suggest(String title, String description) {
        List<Category> categories = categoryRepository.findAll().stream()
                .filter(c -> Boolean.TRUE.equals(c.getIsActive()))
                .toList();

        String inputText = (title + " " + (description != null ? description : "")).toLowerCase();

        // Expand synonyms: replace known phrases with their canonical equivalents
        String expandedText = inputText;
        for (Map.Entry<String, List<String>> entry : SYNONYMS.entrySet()) {
            if (expandedText.contains(entry.getKey())) {
                expandedText += " " + String.join(" ", entry.getValue());
            }
        }

        Set<String> inputTokens = tokenize(expandedText);

        // Score all categories, keep only those with a positive raw score
        List<Suggestion> candidates = categories.stream()
                .map(cat -> scoreCategoryMatch(cat, inputTokens, inputText))
                .filter(s -> s.getScore() > 0)
                .sorted(Comparator.comparingDouble(Suggestion::getScore).reversed())
                .limit(3)
                .collect(Collectors.toList());

        // Normalize scores so the top result = 1.0 and others are proportional.
        // This gives the frontend a meaningful relative-confidence value (0–1)
        // rather than an unbounded raw overlap count.
        if (!candidates.isEmpty()) {
            double maxRaw = candidates.get(0).getScore();   // list is already sorted desc
            if (maxRaw > 0) {
                candidates.replaceAll(s -> Suggestion.builder()
                        .categoryId(s.getCategoryId())
                        .categoryName(s.getCategoryName())
                        .score(Math.round((s.getScore() / maxRaw) * 100.0) / 100.0)
                        .reason(s.getReason())
                        .build());
            }
        }

        log.debug("Category suggestions for '{}': {} results", title, candidates.size());
        return CategorySuggestionResponse.builder().suggestions(candidates).build();
    }

    private Suggestion scoreCategoryMatch(Category cat, Set<String> inputTokens, String inputText) {
        String catText = (cat.getName() + " " + (cat.getDescription() != null ? cat.getDescription() : "")).toLowerCase();
        Set<String> catTokens = tokenize(catText);

        // Intersection size
        long shared = inputTokens.stream().filter(catTokens::contains).count();

        // Bonus for exact category name appearing in input
        double nameBonus = inputText.contains(cat.getName().toLowerCase()) ? 0.3 : 0.0;

        // Normalise by category token count to avoid longer descriptions always winning
        double score = catTokens.isEmpty() ? 0
                : (double) shared / Math.sqrt(catTokens.size()) + nameBonus;

        String reason = shared > 0
                ? shared + " keyword" + (shared > 1 ? "s" : "") + " matched"
                : "Name match";

        // Return raw (un-capped) score; normalization happens in the caller.
        return Suggestion.builder()
                .categoryId(cat.getId())
                .categoryName(cat.getName())
                .score(score)
                .reason(reason)
                .build();
    }

    private Set<String> tokenize(String text) {
        return Arrays.stream(text.split("[\\s.,!?;:\"'()\\[\\]{}/@#\\-_]+"))
                .filter(w -> w.length() > 2 && !STOP_WORDS.contains(w))
                .collect(Collectors.toSet());
    }
}
