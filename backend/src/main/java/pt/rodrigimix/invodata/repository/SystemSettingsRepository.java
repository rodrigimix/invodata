package pt.rodrigimix.invodata.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import pt.rodrigimix.invodata.model.SystemSettings;

public interface SystemSettingsRepository extends JpaRepository<SystemSettings, Long> {
}
