package pt.rodrigimix.invodata.model;

import lombok.Getter;
import lombok.extern.slf4j.Slf4j;

@Getter
@Slf4j
public enum CountryCode {

    PORTUGAL("PT",true),

    AUSTRIA("AT",true),

    BELGIUM("BE",true),

    BULGARIA("BG",true),

    CYPRUS("CY",true),

    CZECH_REPUBLIC("CZ",true),

    GERMANY("DE",true),

    DENMARK("DK",true),

    ESTONIA("EE",true),

    GREECE("EL",true),

    SPAIN("ES",true),

    FINLAND("FI",true),

    FRANCE("FR",true),

    CROATIA("HR",true),

    HUNGARY("HU",true),

    IRELAND("IE",true),

    ITALY("IT",true),

    LITHUANIA("LT",true),

    LUXEMBOURG("LU",true),

    LATVIA("LV",true),

    MALTA("MT",true),

    NETHERLANDS("NL",true),

    POLAND("PL",true),

    ROMANIA("RO",true),

    SWEDEN("SE",true),

    SLOVENIA("SI",true),

    SLOVAKIA("SK",true),

    UNITED_STATES("US",false),

    UNITED_KINGDOM("GB",false),

    BRAZIL("BR",false),

    CANADA("CA",false),

    SWITZERLAND("CH",false);

    private final String isoCode;
    private final boolean belongsToVies;

    CountryCode(String isoCode, boolean belongsToVies) {
        this.isoCode = isoCode;
        this.belongsToVies = belongsToVies;
    }

    public static CountryCode fromValue(String value) {
        if (value == null) {
            log.debug("Country code value is null, returning null");
            return null;
        }
        log.debug("Searching for country code with value: {}", value);
        for (CountryCode code : CountryCode.values()) {

            if (code.isoCode.equalsIgnoreCase(value.trim())) {
                log.debug("Found country code: {} for value: {}", code, value);
                return code;
            }
        }
        log.warn("Country code not found for value: {}", value);
        return null;
    }
}