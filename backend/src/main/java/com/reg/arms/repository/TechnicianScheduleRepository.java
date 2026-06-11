package com.reg.arms.repository;

import com.reg.arms.entity.TechnicianSchedule;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TechnicianScheduleRepository extends JpaRepository<TechnicianSchedule, Long> {

    List<TechnicianSchedule> findByTechnicianIdOrderByDayOfWeek(Long technicianId);

    /** Load today's schedule rows for multiple technicians in one query (avoids N+1). */
    List<TechnicianSchedule> findByTechnicianIdInAndDayOfWeekIgnoreCase(
            List<Long> technicianIds, String dayOfWeek);

    void deleteByTechnicianId(Long technicianId);
}
