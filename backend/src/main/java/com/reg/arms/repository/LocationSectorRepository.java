package com.reg.arms.repository;

import com.reg.arms.entity.LocationSector;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface LocationSectorRepository extends JpaRepository<LocationSector, Long> {
    List<LocationSector> findByDistrictIdOrderByNameAsc(Long districtId);
}
