package com.reg.arms.repository;

import com.reg.arms.entity.LocationDistrict;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface LocationDistrictRepository extends JpaRepository<LocationDistrict, Long> {
    List<LocationDistrict> findByProvinceIdOrderByNameAsc(Long provinceId);
}
