package pt.rodrigimix.invodata.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

public record SicaeResponse (String nipc,
        String name,
        String caePrincipal,
        String designationCae){

}
