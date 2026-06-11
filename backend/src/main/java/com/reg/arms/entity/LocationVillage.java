package com.reg.arms.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "location_villages")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LocationVillage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String name;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cell_id", nullable = false)
    private LocationCell cell;
}
