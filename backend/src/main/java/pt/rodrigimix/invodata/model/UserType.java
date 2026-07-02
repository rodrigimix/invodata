package pt.rodrigimix.invodata.model;

import lombok.Data;
import lombok.Getter;

@Getter
public enum UserType {
    FREE("free", 50),
    VIP("vip", 100);

    private final String type;
    private final int invoiceLimit;

    UserType(String type, int invoiceLimit) {
        this.type = type;
        this.invoiceLimit = invoiceLimit;
    }

    UserType fromValue(String value) {
        if (value == null) {
            return null;
        }
        for (UserType userType : UserType.values()) {

            if (userType.type.equalsIgnoreCase(value.trim())) {
                return userType;
            }
        }
        return null;
    }
}
