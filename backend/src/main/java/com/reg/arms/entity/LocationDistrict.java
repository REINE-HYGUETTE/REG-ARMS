package com.reg.arms.entity;

import jakarta.persistence.*;
import lombok.*;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "location_districts")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LocationDistrict {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String name;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "province_id", nullable = false)
    private LocationProvince province;

    @OneToMany(mappedBy = "district", fetch = FetchType.LAZY)
    @Builder.Default
    private List<LocationSector> sectors = new ArrayList<>();
}
