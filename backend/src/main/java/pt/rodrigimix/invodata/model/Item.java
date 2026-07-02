package pt.rodrigimix.invodata.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Embeddable
@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class Item {

    private String description;
    private Double quantity;
    private Double unitPrice;
    private Double totalPrice;
    private Double taxPrice;
    private Double taxPercent;
}
