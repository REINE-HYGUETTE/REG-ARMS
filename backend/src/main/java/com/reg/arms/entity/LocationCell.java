package com.reg.arms.entity;

import jakarta.persistence.*;
import lombok.*;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "location_cells")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LocationCell {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String name;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sector_id", nullable = false)
    private LocationSector sector;

    @OneToMany(mappedBy = "cell", fetch = FetchType.LAZY)
    @Builder.Default
    private List<LocationVillage> villages = new ArrayList<>();
}
