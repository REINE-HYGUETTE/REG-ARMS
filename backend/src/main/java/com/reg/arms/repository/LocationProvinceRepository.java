package com.reg.arms.repository;

import com.reg.arms.entity.LocationProvince;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface LocationProvinceRepository extends JpaRepository<LocationProvince, Long> {
    List<LocationProvince> findAllByOrderByNameAsc();
}
