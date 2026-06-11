package com.reg.arms.service;

import com.reg.arms.exception.BadRequestException;
import com.reg.arms.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class LocationService {

    private final LocationProvinceRepository provinceRepo;
    private final LocationDistrictRepository districtRepo;
    private final LocationSectorRepository   sectorRepo;
    private final LocationCellRepository     cellRepo;
    private final LocationVillageRepository  villageRepo;

    public record IdName(Long id, String name) {}

    @Transactional(readOnly = true)
    public List<IdName> getProvinces() {
        return provinceRepo.findAllByOrderByNameAsc()
                .stream().map(p -> new IdName(p.getId(), p.getName())).toList();
    }

    @Transactional(readOnly = true)
    public List<IdName> getDistricts(Long provinceId) {
        return districtRepo.findByProvinceIdOrderByNameAsc(provinceId)
                .stream().map(d -> new IdName(d.getId(), d.getName())).toList();
    }

    @Transactional(readOnly = true)
    public List<IdName> getSectors(Long districtId) {
        return sectorRepo.findByDistrictIdOrderByNameAsc(districtId)
                .stream().map(s -> new IdName(s.getId(), s.getName())).toList();
    }

    @Transactional(readOnly = true)
    public List<IdName> getCells(Long sectorId) {
        return cellRepo.findBySectorIdOrderByNameAsc(sectorId)
                .stream().map(c -> new IdName(c.getId(), c.getName())).toList();
    }

    @Transactional(readOnly = true)
    public List<IdName> getVillages(Long cellId) {
        return villageRepo.findByCellIdOrderByNameAsc(cellId)
                .stream().map(v -> new IdName(v.getId(), v.getName())).toList();
    }

    /**
     * Validates that the provided location names form a consistent hierarchy.
     * Called before saving a request or user profile to prevent inconsistent data.
     */
    @Transactional(readOnly = true)
    public void validateLocation(String province, String district, String sector, String cell) {
        // Province must exist
        var provinces = provinceRepo.findAllByOrderByNameAsc();
        var matchedProvince = provinces.stream()
                .filter(p -> p.getName().equalsIgnoreCase(province))
                .findFirst()
                .orElseThrow(() -> new BadRequestException("Invalid province: " + province));

        // District must belong to the province
        var districts = districtRepo.findByProvinceIdOrderByNameAsc(matchedProvince.getId());
        var matchedDistrict = districts.stream()
                .filter(d -> d.getName().equalsIgnoreCase(district))
                .findFirst()
                .orElseThrow(() -> new BadRequestException(
                        "District '" + district + "' does not belong to province '" + province + "'"));

        // Sector must belong to the district
        var sectors = sectorRepo.findByDistrictIdOrderByNameAsc(matchedDistrict.getId());
        var matchedSector = sectors.stream()
                .filter(s -> s.getName().equalsIgnoreCase(sector))
                .findFirst()
                .orElseThrow(() -> new BadRequestException(
                        "Sector '" + sector + "' does not belong to district '" + district + "'"));

        // Cell must belong to the sector
        var cells = cellRepo.findBySectorIdOrderByNameAsc(matchedSector.getId());
        cells.stream()
                .filter(c -> c.getName().equalsIgnoreCase(cell))
                .findFirst()
                .orElseThrow(() -> new BadRequestException(
                        "Cell '" + cell + "' does not belong to sector '" + sector + "'"));
    }
}
