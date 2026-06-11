package com.reg.arms.repository;

import com.reg.arms.entity.LocationCell;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface LocationCellRepository extends JpaRepository<LocationCell, Long> {
    List<LocationCell> findBySectorIdOrderByNameAsc(Long sectorId);
}
