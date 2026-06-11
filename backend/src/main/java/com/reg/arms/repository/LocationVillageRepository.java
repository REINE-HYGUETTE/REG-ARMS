package com.reg.arms.repository;

import com.reg.arms.entity.LocationVillage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface LocationVillageRepository extends JpaRepository<LocationVillage, Long> {
    List<LocationVillage> findByCellIdOrderByNameAsc(Long cellId);
}
