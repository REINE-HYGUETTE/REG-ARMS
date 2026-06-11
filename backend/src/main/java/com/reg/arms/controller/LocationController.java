package com.reg.arms.controller;

import com.reg.arms.service.LocationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/locations")
@RequiredArgsConstructor
public class LocationController {

    private final LocationService locationService;

    @GetMapping("/provinces")
    public ResponseEntity<List<LocationService.IdName>> getProvinces() {
        return ResponseEntity.ok(locationService.getProvinces());
    }

    @GetMapping("/districts")
    public ResponseEntity<List<LocationService.IdName>> getDistricts(
            @RequestParam Long provinceId) {
        return ResponseEntity.ok(locationService.getDistricts(provinceId));
    }

    @GetMapping("/sectors")
    public ResponseEntity<List<LocationService.IdName>> getSectors(
            @RequestParam Long districtId) {
        return ResponseEntity.ok(locationService.getSectors(districtId));
    }

    @GetMapping("/cells")
    public ResponseEntity<List<LocationService.IdName>> getCells(
            @RequestParam Long sectorId) {
        return ResponseEntity.ok(locationService.getCells(sectorId));
    }

    @GetMapping("/villages")
    public ResponseEntity<List<LocationService.IdName>> getVillages(
            @RequestParam Long cellId) {
        return ResponseEntity.ok(locationService.getVillages(cellId));
    }
}
