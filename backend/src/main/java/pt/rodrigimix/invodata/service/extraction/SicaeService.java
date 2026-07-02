package pt.rodrigimix.invodata.service.extraction;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Element;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import pt.rodrigimix.invodata.config.AppConfig;
import pt.rodrigimix.invodata.dto.SicaeResponse;
import org.jsoup.nodes.Document;

@Deprecated
@Service
public class SicaeService {

    private static final Logger logger = LoggerFactory.getLogger(SicaeService.class);

    private static final String INPUT_FIRMA_ID = "ctl00_MainContent_ipFirma";
    private static final String TABLE_DETAIL_ID = "ctl00_MainContent_DetalheDataGrid";
    private static final String DIV_CAE_ID = "letrasCAE";

    private final AppConfig appConfig;

    @Autowired
    public SicaeService(AppConfig appConfig) {
        this.appConfig = appConfig;
    }

    public SicaeResponse consultSicae(String nipc) {
        logger.info("Starting SICAE consultation.");
        try {
            String url = appConfig.getSicaeUrl() + nipc;
            logger.debug("Connecting to SICAE URL: {}", url);
            Document doc = Jsoup.connect(url).timeout(10000).get();

            String name = doc.select("input#" + INPUT_FIRMA_ID).val();

            Element table = doc.selectFirst("table#" + TABLE_DETAIL_ID);

            if (table != null) {
                Element firstDataRow = table.select("tr").get(1);
                Element caeColumn = firstDataRow.select("td").get(1);
                Element caeDiv = caeColumn.selectFirst("div#" + DIV_CAE_ID);

                if (caeDiv != null) {
                    String caeCode = caeDiv.text().trim();
                    String caeDescription = caeDiv.attr("title").trim();

                    logger.info("Successfully extracted SICAE data.");
                    return new SicaeResponse(nipc, name, caeCode, caeDescription);
                }
            }
            logger.warn("No CAE data found.");
        } catch (Exception e) {
            logger.error("Error extracting data from SICAE: {}", e.getMessage(), e);
        }
        return null;
    }
}