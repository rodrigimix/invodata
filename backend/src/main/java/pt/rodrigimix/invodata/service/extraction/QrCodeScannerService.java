package pt.rodrigimix.invodata.service.extraction;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;
import pt.rodrigimix.invodata.config.AppConfig;
import pt.rodrigimix.invodata.dto.QrCodeResponse;

import java.io.IOException;
import java.util.*;

@Deprecated
@Slf4j
@Service
public class QrCodeScannerService {

    private final RestTemplate restTemplate = new RestTemplate();

    private final AppConfig appConfig;

    @Autowired
    public QrCodeScannerService(AppConfig appConfig) {
        this.appConfig = appConfig;
    }


    public List<String> scanPdf(MultipartFile file) throws IOException {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("file", new ByteArrayResource(file.getBytes()) {
            @Override
            public String getFilename() {
                return file.getOriginalFilename();
            }
        });
        HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);

        try {
            String api = appConfig.getPythonApi() + "/scan-qr";
            ResponseEntity<QrCodeResponse> response = restTemplate.postForEntity(api, requestEntity, QrCodeResponse.class);

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                return response.getBody().qr_codes();
            }
        } catch (Exception e) {
            log.error("Error communicating with Python scanner: {}", e.getMessage(), e);
        }

        return Collections.emptyList();
    }
}