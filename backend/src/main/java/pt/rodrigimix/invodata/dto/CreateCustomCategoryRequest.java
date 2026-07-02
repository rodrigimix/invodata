package pt.rodrigimix.invodata.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CreateCustomCategoryRequest {
    @JsonProperty("name")
    private String name;

    @JsonProperty("color")
    private String color;
}

