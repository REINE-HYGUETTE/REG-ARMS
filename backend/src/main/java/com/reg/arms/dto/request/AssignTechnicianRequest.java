package com.reg.arms.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AssignTechnicianRequest {

    /**
     * The {@code users.id} (primary key of the users table) for the technician
     * to assign.  Despite the name "technicianId" this is NOT the
     * {@code technicians.id} from the separate technicians table — it is the
     * user account ID of a user whose role is TECHNICIAN.
     *
     * <p>The frontend should send {@code rec.userId} from
     * {@code TechnicianRecommendationResponse}, not {@code rec.id}.
     */
    @NotNull(message = "Technician ID is required")
    private Long technicianId;

    /**
     * Rank of this technician in the AI recommendation list (1 = top pick).
     * Optional — sent by the frontend when staff assigns from the recommendations panel.
     * Used to measure how often staff follow the AI's top suggestion.
     */
    private Integer recommendationRank;
}
