package pt.rodrigimix.invodata.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class VIESResponse {
    private String name;
    @JsonProperty("isValid")
    private Boolean isValid;
}
