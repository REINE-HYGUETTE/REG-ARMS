package com.reg.arms.dto.request;

import lombok.Getter;
import lombok.Setter;

import java.util.List;

/**
 * Staff / Admin request to update a technician's operational profile fields.
 * These are separate from the user account fields (name, email, etc.)
 * and control how the smart-matching algorithm ranks this technician.
 */
@Getter
@Setter
public class UpdateTechnicianProfileRequest {

    /** Free-text specialization description (kept for display / legacy matching) */
    private String specialization;

    /** Exact category names this technician specialises in (used for precise tag matching) */
    private List<String> specializationTags;

    /** Provinces this technician can be assigned to */
    private List<String> provinceCoverage;

    /** Districts within those provinces (for more precise location scoring) */
    private List<String> districtCoverage;

    /** Maximum simultaneous active tasks this technician can handle */
    private Integer maxWorkload;
}
