package com.reg.arms.repository;

import com.reg.arms.entity.Technician;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TechnicianRepository extends JpaRepository<Technician, Long> {

    Optional<Technician> findByUserId(Long userId);

    List<Technician> findByIsAvailableTrueOrderByCurrentWorkloadAsc();

    /** All technicians whose user account belongs to a specific district (case-insensitive). */
    List<Technician> findByUser_DistrictIgnoreCase(String district);

    /** Available technicians in a specific district (case-insensitive). */
    List<Technician> findByUser_DistrictIgnoreCaseAndIsAvailableTrue(String district);

    /** Technicians in a district that are currently NOT pursuing any request (free). */
    List<Technician> findByUser_DistrictIgnoreCaseAndPursuingRequestIsNull(String district);

    /** Technicians in a district that are currently pursuing a request. */
    List<Technician> findByUser_DistrictIgnoreCaseAndPursuingRequestIsNotNull(String district);
}
